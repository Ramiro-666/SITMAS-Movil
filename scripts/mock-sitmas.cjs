// Servidor de prueba local: datos ficticios en memoria; jamás reenvía a la API real.
// Primero ejecutar expo export --platform web. Luego: node scripts/mock-sitmas.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const port = 8097;
const calls = [];
let failNextWrite = null;
const failedReads = new Set();
const db = {
  locations: [
    {
      IdUbicacion: 1,
      Descripcion: 'Plaza de prueba',
      Latitud: -31.4167,
      Longitud: -64.1833,
    },
    {
      IdUbicacion: 2,
      Descripcion: 'Depósito de prueba',
      Latitud: -31.425,
      Longitud: -64.19,
    },
  ],
  vehicles: [{ Id: 1, Patente: 'DEMO-001', Id_Modelo: 1, Id_Tipo: 1 }],
  brands: [{ Id: 1, MarcaVehiculo: 'Marca demo' }],
  models: [{ Id: 1, ModeloVehiculo: 'Modelo demo', Id_Marca: 1 }],
  types: [{ Id: 1, TipoVehiculo: 'Camión demo' }],
  routes: [
    { Id: 1, HojaRutaFecha: '2026-09-25', Id_Vehiculo: 1, Id_Chofer: 1 },
    { Id: 2, HojaRutaFecha: '2026-09-26', Id_Vehiculo: 1, Id_Chofer: 1 },
  ],
  stops: [
    {
      Id_Detalle_HDR: 1,
      Id_HojaRuta: 1,
      Id_TipoMovimiento: 1,
      Id_RecursoMov: 1,
      Id_Origen: 1,
      Id_TipoMaterial: 1,
      Id_Estado: 1,
      HoraEstimada: '08:00:00',
      Origen: 'Origen demo',
      DistanciaDesdeAnterior_Km: 12,
      Id_Ubicacion: 1,
    },
  ],
  odometers: [],
};
// Hoja 1 con un recorrido real entre coordenadas ficticias; hoja 2 vacía.
for (let i = 0; i < 2; i++) {
  db.stops.push({
    ...db.stops[0],
    Id_Detalle_HDR: i + 2,
    HoraEstimada: i ? '10:00:00' : '09:00:00',
    Id_Ubicacion: i ? 3 : 2,
  });
}
db.locations.push({
  IdUbicacion: 3,
  Descripcion: 'Destino de prueba',
  Latitud: -31.435,
  Longitud: -64.185,
});
function headers(r) {
  return {
    ...r,
    FechaFormateada: r.HojaRutaFecha.split('-').reverse().join('/'),
    Vehiculo: db.vehicles.find((v) => v.Id === r.Id_Vehiculo)?.Patente,
    ChoferNombreCompleto: 'Chofer demo',
  };
}
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (data, status = 200) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === '/__test__/metrics') return send({ calls, db });
    if (url.pathname === '/__test__/fail-next-write' && req.method === 'POST') {
      failNextWrite = url.searchParams.get('route') || '*';
      return send({ ok: true });
    }
    if (url.pathname === '/__test__/fail-read' && req.method === 'POST') {
      const route = url.searchParams.get('route');
      if (url.searchParams.get('enabled') === 'false')
        failedReads.delete(route);
      else failedReads.add(route);
      return send({ ok: true });
    }
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE',
        });
        return res.end();
      }
      const route = url.pathname.slice(5).toLowerCase();
      let body = '';
      for await (const chunk of req) body += chunk;
      const data = body ? JSON.parse(body) : {};
      calls.push({ method: req.method, route }); // No registrar contraseñas, ni siquiera de prueba.
      if (route === 'usuario/login')
        return send({
          idUsuario: 1,
          nombre: 'Usuario de prueba',
          rol: 'Logística',
        });
      if (req.method === 'GET' && failedReads.has(route))
        return send({ Message: 'Lectura fallida simulada' }, 503);
      if (
        req.method !== 'GET' &&
        (failNextWrite === '*' || failNextWrite === route)
      ) {
        failNextWrite = null;
        return send({ Message: 'Fallo simulado' }, 500);
      }
      const catalogs = {
        tipomovimientos: [
          { IdTipoMovimientos: 1, TipoMovimientos: 'Recolección' },
        ],
        recursosmovilizados: [
          { IdRecursoMov: 1, Recurso_Movilizado: 'Material' },
        ],
        origen: Array.from({ length: 14 }, (_, i) => ({
          IdOrigen: i + 1,
          EmpresaInstitucion: i ? 'Origen de prueba ' + (i + 1) : 'Origen demo',
        })),
        'tp_material/listartodo': [
          { IdTipoMaterial: 1, TipoMaterial: 'Papel' },
        ],
        'est_hdr/listartodo': [{ Id: 1, EstadoHojaRuta: 'Pendiente' }],
        'empleado/listarchoferes': [
          { Id: 1, Nombre: 'Chofer', Apellido: 'Demo' },
        ],
      };
      if (catalogs[route]) return send(catalogs[route]);
      if (route === 'dashboard/pesobrutoacumulado')
        return send([
          {
            Categoria: 'Reciclables',
            SubtipoMaterial: 'Papel',
            TotalPesoBrutoKg: 100,
            CantidadPesadas: 3,
          },
        ]);
      if (route === 'dashboard/rendimientoclasificacion')
        return send([
          {
            Categoria: 'Reciclables',
            SubtipoMaterial: 'Papel',
            TotalPesoBrutoKg: 100,
            TotalPesoUtilKg: 80,
            TotalDescarteKg: 20,
            PorcentajeRecuperacion: 80,
          },
        ]);
      if (route === 'movimientosalida/stockneto')
        return send([
          {
            Categoria: 'Reciclables',
            SubtipoMaterial: 'Papel',
            StockDisponibleKg: 80,
          },
        ]);
      for (const [prefix, table] of [
        ['vehiculo', 'vehicles'],
        ['marcaveh', 'brands'],
        ['modeloveh', 'models'],
        ['tp_vehiculo', 'types'],
      ]) {
        if (!route.startsWith(prefix + '/')) continue;
        if (req.method === 'GET') return send(db[table]);
        const id = Number(route.split('/').at(-1));
        if (route.includes('borrar'))
          db[table] = db[table].filter((x) => x.Id !== id);
        else if (route.includes('modificar'))
          db[table] = db[table].map((x) =>
            x.Id === id ? { ...x, ...data } : x,
          );
        else
          db[table].push({
            ...data,
            Id: Math.max(0, ...db[table].map((x) => x.Id)) + 1,
          });
        return send({ ok: true });
      }
      if (route === 'ubicaciongeografica') {
        if (req.method === 'GET') return send(db.locations);
        const IdUbicacion =
          Math.max(0, ...db.locations.map((x) => x.IdUbicacion)) + 1;
        db.locations.push({ ...data, IdUbicacion });
        return send({ IdUbicacionGenerado: IdUbicacion }, 201);
      }
      if (route === 'registroodometro') {
        if (req.method === 'GET') return send(db.odometers);
        const row = {
          ...data,
          IdRegistroOdomet: db.odometers.length + 1,
          Patente: db.vehicles.find((v) => v.Id === data.IdVehiculo)?.Patente,
        };
        db.odometers.push(row);
        return send(row);
      }
      if (route === 'hojaruta') {
        if (req.method === 'GET') return send(db.routes.map(headers));
        const Id = Math.max(0, ...db.routes.map((x) => x.Id)) + 1;
        db.routes.push({ ...data, Id });
        return send({ IdGenerado: Id });
      }
      if (/^hojaruta\/\d+$/.test(route)) {
        const id = Number(route.split('/')[1]);
        if (req.method === 'GET')
          return send(db.routes.find((x) => x.Id === id) || null);
        if (req.method === 'DELETE') {
          db.routes = db.routes.filter((x) => x.Id !== id);
          db.stops = db.stops.filter((x) => x.Id_HojaRuta !== id);
        } else
          db.routes = db.routes.map((x) =>
            x.Id === id ? { ...x, ...data } : x,
          );
        return send({ ok: true });
      }
      if (route.startsWith('detallehojaruta/hojaruta/'))
        return send(
          db.stops
            .filter((x) => x.Id_HojaRuta === Number(route.split('/').at(-1)))
            .map((x) => ({
              ...x,
              HoraEstimadaFormateada: x.HoraEstimada,
              Origen:
                db.locations.find(
                  (location) => location.IdUbicacion === x.Id_Ubicacion,
                )?.Descripcion || x.Origen,
              Latitud:
                db.locations.find(
                  (location) => location.IdUbicacion === x.Id_Ubicacion,
                )?.Latitud ?? null,
              Longitud:
                db.locations.find(
                  (location) => location.IdUbicacion === x.Id_Ubicacion,
                )?.Longitud ?? null,
            })),
        );
      if (route.startsWith('detallehojaruta')) {
        const id = Number(route.split('/')[1]);
        if (req.method === 'DELETE')
          db.stops = db.stops.filter((x) => x.Id_Detalle_HDR !== id);
        else if (req.method === 'PUT')
          db.stops = db.stops.map((x) =>
            x.Id_Detalle_HDR === id ? { ...x, ...data } : x,
          );
        else
          db.stops.push({
            ...data,
            Id_Detalle_HDR:
              Math.max(0, ...db.stops.map((x) => x.Id_Detalle_HDR)) + 1,
            Origen: 'Origen demo',
          });
        return send({ ok: true });
      }
      return send({ error: 'Ruta no simulada: ' + route }, 404);
    }
    const file = path.resolve(
      root,
      '.' +
        decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
    );
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      res.writeHead(404);
      return res.end();
    }
    const ext = path.extname(file);
    const types = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
    };
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
    });
    // Sustituir solo la URL de la API en la copia servida para las pruebas, nunca en el artefacto.
    res.end(
      ext === '.js'
        ? fs
            .readFileSync(file, 'utf8')
            .replaceAll(
              'https://localhost:44325/api',
              'http://localhost:' + port + '/api',
            )
        : fs.readFileSync(file),
    );
  })
  .listen(port, '127.0.0.1', () => {
    console.log('SITMAS simulado: http://localhost:' + port);
    process.send?.('ready');
  });
