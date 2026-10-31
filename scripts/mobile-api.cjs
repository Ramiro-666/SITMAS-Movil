const https = require('node:https');
const { crearAvisosViaje } = require('./avisos-viaje.cjs');
const denied = 'Su usuario no tiene los permisos necesarios para utilizar SITMAS Móvil, comuníquese con su supervisor.';
const allowed = id => id === 1 || id === 11;
const routes = {
  GET: /^(?:trip-alerts|hojaruta(?:\/(?:hoy|\d+))?|detallehojaruta\/(?:pendientes|hojaruta\/\d+)|(?:Vehiculo|Tp_Vehiculo|MarcaVeh|ModeloVeh|EST_HDR)\/ListarTodo|tipomovimientos|recursosmovilizados|origen|TP_Material|MaterialClasificado\/ListarVista|MovimientoSalida\/StockNeto|Dashboard\/(?:PesoBrutoAcumulado|RendimientoClasificacion)|registroodometro)$/i,
  POST: /^(?:Usuario\/Login|Vehiculo|(?:Tp_Vehiculo\/(?:Insertar|Modificar\/\d+|Borrar\/\d+))|(?:MarcaVeh|ModeloVeh)\/Insertar|hojaruta|detallehojaruta|ubicaciongeografica|registroodometro(?:\/iniciar-ruta)?)$/i,
  PUT: /^(?:Vehiculo\/\d+|(?:MarcaVeh|ModeloVeh)\/Modificar\/\d+|registroodometro\/finalizar-ruta\/\d+)$/i,
  PATCH: /^(?:hojaruta\/\d+\/(?:distanciatotal|iniciar|finalizar|forzar-finalizacion)|detallehojaruta\/\d+\/asignar)$/i,
  DELETE: /^(?:Vehiculo\/\d+|(?:MarcaVeh|ModeloVeh)\/Borrar\/\d+|detallehojaruta\/\d+)$/i,
};

function claims(token) {
  try {
    if (typeof token !== 'string' || token.length > 8192 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return null;
    const [header, payload] = token.split('.').slice(0, 2).map(p => JSON.parse(Buffer.from(p, 'base64url')));
    if (header.alg !== 'HS256' || !/^[1-9]\d*$/.test(payload.sub) || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
}

// La firma la valida SITMAS en cada consulta: decodificar el JWT nunca concede acceso.
function createMobileHandler({ upstream, hosts, origins = [], alerts = crearAvisosViaje() }) {
  return async (req, res) => {
    const send = (status, value) => {
      if (!res.destroyed) res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(JSON.stringify(value));
    };
    const host = req.headers.host ?? '';
    if (!/^[a-z\d.-]+(?::\d+)?$/i.test(host) || !hosts.includes(host.split(':')[0]) || !req.url.startsWith('/api/') || req.url.length > 4096) { send(404, {}); return; }
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) { send(403, { Message: 'Origen no permitido.' }); return; }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      send(204); return;
    }
    const rawPath = req.url.split('?')[0];
    const route = rawPath.slice(5);
    if (!routes[req.method]?.test(route)) { send(404, {}); return; }
    const login = req.method === 'POST' && /^Usuario\/Login$/i.test(route);
    try {
      const verify = async token => {
        const payload = claims(token);
        if (!payload) return 401;
        const id = Number(payload.sub);
        if (!allowed(id)) return 403;
        // El handler original valida firma y vencimiento antes de devolver este usuario.
        const check = await upstream(`/api/Usuario/ListarPorId/${id}`, 'GET', { authorization: `Bearer ${token}` });
        if (check.status === 401) return 401;
        if (check.status !== 200) throw new Error('No se pudo validar la sesión.');
        const user = JSON.parse(check.body);
        if (user.Id !== id || user.Id_Estado_Usuario !== 1) return 403;
        return 200;
      };
      const token = /^Bearer ([\w.-]+)$/.exec(req.headers.authorization ?? '')?.[1];
      if (!login) {
        const status = await verify(token);
        if (status !== 200) { send(status, { Message: status === 403 ? denied : 'Token inválido o expirado.' }); return; }
      }
      if (req.method === 'GET' && route === 'trip-alerts') { send(200, alerts.events(Number(claims(token).sub))); return; }
      const forced = req.method === 'PATCH' && /^hojaruta\/(\d+)\/forzar-finalizacion$/i.exec(route);
      if (forced) {
        // La firma del token ya fue validada por SITMAS en verify.
        const payload = claims(token);
        const roles = payload.role ?? payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
        if (![roles].flat().some(role => typeof role === 'string' && role.split(',').some(value => value.trim().toLowerCase() === 'administrador'))) {
          send(403, { Message: 'Solo el administrador puede forzar la finalización.' }); return;
        }
        const path = `/api/hojaruta/${forced[1]}`;
        const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
        const before = await upstream(path, 'GET', headers);
        if (before.status !== 200) { send(before.status, { Message: 'No se pudo consultar la hoja de ruta.' }); return; }
        const routeData = JSON.parse(before.body);
        if (routeData.Id_Estado !== 3) { send(409, { Message: 'El viaje ya no está en curso. Actualizá los datos.' }); return; }
        const distance = routeData.Distancia_Total_Estimada_Km;
        if (!Number.isFinite(distance) || distance < 0) { send(409, { Message: 'La hoja no tiene una distancia válida registrada.' }); return; }
        try { await upstream(`${path}/finalizar`, 'PATCH', headers, Buffer.from(JSON.stringify({ DistanciaTotal: distance }))); }
        catch { /* Releer confirma un cierre cuya respuesta se perdió. */ }
        const after = await upstream(path, 'GET', headers);
        if (after.status !== 200 || JSON.parse(after.body).Id_Estado !== 5) throw new Error('Cierre sin confirmar.');
        if (Number.isInteger(routeData.Id_Chofer) && routeData.Id_Chofer > 0) alerts.closed(routeData.Id_Chofer, routeData.Id);
        send(200, { Mensaje: 'Viaje finalizado por el administrador.' }); return;
      }
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 128 * 1024) { send(413, { Message: 'Solicitud demasiado grande.' }); return; }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      const response = await upstream(req.url, req.method, {
        ...(token && !login ? { authorization: `Bearer ${token}` } : {}),
        ...(body.length ? { 'content-type': 'application/json' } : {}),
      }, body);
      if (response.status >= 500) throw new Error('Error de SITMAS.');
      if (login && response.status === 200) {
        const session = JSON.parse(response.body);
        if (!allowed(session.idUsuario)) { send(403, { Message: denied }); return; }
        const payload = claims(session.token);
        if (!payload || Number(payload.sub) !== session.idUsuario) throw new Error('Sesión inválida.');
        const status = await verify(session.token);
        if (status !== 200) { send(status, { Message: status === 403 ? denied : 'Token inválido o expirado.' }); return; }
      }
      res.writeHead(response.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(response.body);
    } catch {
      send(502, { Message: 'No se pudo validar la sesión o consultar SITMAS. Reintentá cuando la API esté disponible.' });
    }
  };
}

function createUpstream(ca) {
  return (path, method, headers, body) => new Promise((resolve, reject) => {
    const request = https.request({ hostname: 'localhost', port: 44325, path, method, ca, timeout: 15000, headers: { ...headers, Accept: 'application/json' } }, response => {
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 10 * 1024 * 1024) response.destroy(new Error('Respuesta demasiado grande.'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.on('timeout', () => request.destroy(new Error('Tiempo agotado.')));
    request.on('error', reject);
    request.end(body);
  });
}

module.exports = { createMobileHandler, createUpstream };
