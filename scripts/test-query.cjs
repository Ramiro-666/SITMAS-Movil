// Pruebas aisladas: fetch simulado, sin conexión con SITMAS ni SQL.
const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
const { queryClient } = require('../src/query/client.ts');
const { queries, keys } = require('../src/query/sitmas.ts');
const { useSessionStore } = require('../src/state/session-store.ts');
const { sitmasApi } = require('../src/services/sitmas-api.ts');
queryClient.setDefaultOptions({
  queries: { ...queryClient.getDefaultOptions().queries, gcTime: Infinity },
});
const originalFetch = global.fetch;
afterEach(() => {
  queryClient.clear();
  useSessionStore.setState({ session: null });
  global.fetch = originalFetch;
});

test('dos consumidores comparten solicitud y caché de vehículos', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return new Response(JSON.stringify([{ Id: 1, Patente: 'TEST' }]));
  };
  const [first, second] = await Promise.all([
    queryClient.fetchQuery(queries.vehiculos),
    queryClient.fetchQuery(queries.vehiculos),
  ]);
  assert.deepEqual(first, second);
  await queryClient.fetchQuery(queries.vehiculos);
  assert.equal(calls, 1);
});

test('paradas de dos hojas tienen cachés independientes', async () => {
  global.fetch = async (url) =>
    new Response(
      JSON.stringify([
        { Id_Detalle_HDR: Number(String(url).split('/').at(-1)) },
      ]),
    );
  await Promise.all([
    queryClient.fetchQuery(queries.paradas(1)),
    queryClient.fetchQuery(queries.paradas(2)),
  ]);
  assert.equal(queryClient.getQueryData(keys.paradas(1))[0].Id_Detalle_HDR, 1);
  assert.equal(queryClient.getQueryData(keys.paradas(2))[0].Id_Detalle_HDR, 2);
});

test('fallo al refrescar conserva datos previos y deja otras consultas intactas', async () => {
  queryClient.setQueryData(keys.vehiculos, [{ Id: 1 }]);
  queryClient.setQueryData(keys.marcas, [{ Id: 5 }]);
  global.fetch = async () =>
    new Response('Servidor no disponible', { status: 503 });
  await assert.rejects(
    queryClient.fetchQuery({
      ...queries.vehiculos,
      staleTime: 0,
      retry: false,
    }),
  );
  assert.deepEqual(queryClient.getQueryData(keys.vehiculos), [{ Id: 1 }]);
  assert.deepEqual(queryClient.getQueryData(keys.marcas), [{ Id: 5 }]);
});

test('invalidar hojas alcanza ambas agendas y no invalida los catálogos', async () => {
  queryClient.setQueryData(keys.paradas(1), []);
  queryClient.setQueryData(keys.paradas(2), []);
  queryClient.setQueryData(keys.marcas, []);
  await queryClient.invalidateQueries({ queryKey: keys.hojas });
  assert.equal(queryClient.getQueryState(keys.paradas(1)).isInvalidated, true);
  assert.equal(queryClient.getQueryState(keys.paradas(2)).isInvalidated, true);
  assert.equal(queryClient.getQueryState(keys.marcas).isInvalidated, false);
});

test('salir cancela peticiones y limpia los datos del usuario anterior', async () => {
  useSessionStore
    .getState()
    .signIn({ idUsuario: 1, nombre: 'Prueba', rol: 'Prueba' });
  let receivedSignal;
  global.fetch = (_, { signal }) =>
    new Promise((resolve, reject) => {
      receivedSignal = signal;
      signal.addEventListener('abort', () => reject(new Error('Cancelado')), {
        once: true,
      });
    });
  const request = queryClient.fetchQuery(queries.vehiculos).catch(() => null);
  queryClient.setQueryData(keys.marcas, [{ Id: 123 }]);
  useSessionStore.getState().signOut();
  await request;
  assert.equal(receivedSignal.aborted, true);
  assert.equal(useSessionStore.getState().session, null);
  assert.equal(queryClient.getQueryCache().getAll().length, 0);
  useSessionStore
    .getState()
    .signIn({ idUsuario: 2, nombre: 'Otro', rol: 'Prueba' });
  assert.equal(queryClient.getQueryData(keys.marcas), undefined);
});

test('servicio usa el nuevo origen y conserva distancia/GPS al editar paradas', async () => {
  const requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url, init });
    return new Response('{}');
  };
  await sitmasApi.origenes();
  const stop = {
    Id_Detalle_HDR: 1,
    Id_HojaRuta: 2,
    Id_Ubicacion: 8,
    DistanciaDesdeAnterior_Km: 12.5,
    HoraEstimada: '09:00:00',
  };
  await sitmasApi.actualizarParada(stop);
  assert.ok(requests[0].url.endsWith('/api/origen'));
  assert.deepEqual(JSON.parse(requests[1].init.body), stop);
});

const { saveStopWithLocation } = require('../src/services/save-stop.ts');

test('ubicación guardada se reutiliza sin crear otra y conserva distancia', async () => {
  const requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url, data: JSON.parse(init.body) });
    return new Response('{}');
  };
  await saveStopWithLocation(
    {
      Id_Detalle_HDR: 3,
      Id_HojaRuta: 1,
      Id_Origen: 7,
      DistanciaDesdeAnterior_Km: 12,
    },
    { IdUbicacion: 8, Descripcion: 'Punto', Latitud: -31.4, Longitud: -64.1 },
    () => assert.fail('No debe crear ubicación'),
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].data.Id_Ubicacion, 8);
  assert.equal(requests[0].data.Id_Origen, 0);
  assert.equal(requests[0].data.DistanciaDesdeAnterior_Km, 12);
});

test('fallo parcial conserva ubicación creada y reintento no la duplica', async () => {
  let location = {
    Descripcion: 'Nuevo punto',
    Latitud: -31.4,
    Longitud: -64.1,
  };
  let created = 0;
  let stopAttempts = 0;
  global.fetch = async (url) => {
    if (url.endsWith('/ubicaciongeografica')) {
      created++;
      return new Response(JSON.stringify({ IdUbicacionGenerado: 9 }));
    }
    stopAttempts++;
    return new Response('{}', { status: stopAttempts === 1 ? 500 : 200 });
  };
  const payload = { Id_HojaRuta: 1, Id_Origen: 0 };
  await assert.rejects(
    saveStopWithLocation(payload, location, (saved) => {
      location = saved;
    }),
  );
  assert.equal(location.IdUbicacion, 9);
  await saveStopWithLocation(payload, location, () =>
    assert.fail('No debe duplicar ubicación'),
  );
  assert.equal(created, 1);
  assert.equal(stopAttempts, 2);
});

test('cambiar de GPS a origen limpia el vínculo geográfico anterior', async () => {
  let payload;
  global.fetch = async (_, init) => {
    payload = JSON.parse(init.body);
    return new Response('{}');
  };
  await saveStopWithLocation(
    {
      Id_Detalle_HDR: 2,
      Id_HojaRuta: 1,
      Id_Origen: 5,
      Id_Ubicacion: 8,
      Latitud: -31.4,
      Longitud: -64.1,
    },
    null,
    () => {},
  );
  assert.equal(payload.Id_Origen, 5);
  assert.equal(payload.Id_Ubicacion, null);
  assert.equal(payload.Latitud, null);
  assert.equal(payload.Longitud, null);
});

test('login distingue un rechazo de credenciales de un fallo de conexión', async () => {
  const { ApiError } = require('../src/services/sitmas-api.ts');
  global.fetch = async () => new Response('{}', { status: 401 });
  await assert.rejects(
    sitmasApi.login('usuario-de-prueba', 'clave-de-prueba'),
    (error) => error instanceof ApiError && error.status === 401,
  );
  const disconnected = new TypeError('Failed to fetch');
  global.fetch = async () => {
    throw disconnected;
  };
  await assert.rejects(
    sitmasApi.login('usuario-de-prueba', 'clave-de-prueba'),
    (error) => error === disconnected && !(error instanceof ApiError),
  );
});

const { fetchRoadRoute } = require('../src/services/route-geometry.ts');

test('OSRM recibe longitud,latitud y devuelve geometría vial, distancia y duración', async () => {
  global.fetch = async (url) => {
    assert.match(
      url,
      /-64.1,-31.1;-64.2,-31.2\?overview=full&geometries=geojson/,
    );
    return Response.json({
      code: 'Ok',
      routes: [
        {
          distance: 2500,
          duration: 600,
          geometry: {
            coordinates: [
              [-64.1, -31.1],
              [-64.15, -31.12],
              [-64.2, -31.2],
            ],
          },
        },
      ],
    });
  };
  const route = await fetchRoadRoute([
    [
      { latitude: -31.1, longitude: -64.1 },
      { latitude: -31.2, longitude: -64.2 },
    ],
  ]);
  assert.equal(route.paths[0].length, 3);
  assert.deepEqual(route.paths[0][1], { latitude: -31.12, longitude: -64.15 });
  assert.equal(route.distance, 2500);
  assert.equal(route.duration, 600);
});
test('ruteo rechaza NoRoute y coordenadas corruptas sin inventar líneas rectas', async () => {
  const segment = [
    [
      { latitude: -31, longitude: -64 },
      { latitude: -32, longitude: -65 },
    ],
  ];
  global.fetch = async () => Response.json({ code: 'NoRoute', routes: [] });
  await assert.rejects(fetchRoadRoute(segment), /No hay un recorrido/);
  global.fetch = async () =>
    Response.json({
      code: 'Ok',
      routes: [
        {
          distance: 10,
          duration: 5,
          geometry: {
            coordinates: [
              [null, null],
              [-64, -31],
            ],
          },
        },
      ],
    });
  await assert.rejects(fetchRoadRoute(segment), /inválido/);
});
test('hojas extensas se dividen en lotes manteniendo el punto de unión', async () => {
  const requested = [];
  global.fetch = async (url) => {
    const coords = url
      .split('/driving/')[1]
      .split('?')[0]
      .split(';')
      .map((pair) => pair.split(',').map(Number));
    requested.push(coords);
    return Response.json({
      code: 'Ok',
      routes: [
        { distance: 100, duration: 50, geometry: { coordinates: coords } },
      ],
    });
  };
  const points = Array.from({ length: 30 }, (_, i) => ({
    latitude: -31 - i / 100,
    longitude: -64,
  }));
  const route = await fetchRoadRoute([points]);
  assert.deepEqual(
    requested.map((points) => points.length),
    [25, 6],
  );
  assert.deepEqual(requested[0].at(-1), requested[1][0]);
  assert.equal(route.distance, 200);
});
test('cambiar de hoja cancela la consulta de recorrido anterior', async () => {
  let requestSignal;
  global.fetch = (_, { signal }) =>
    new Promise((resolve, reject) => {
      requestSignal = signal;
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      );
    });
  const controller = new AbortController();
  const pending = fetchRoadRoute(
    [
      [
        { latitude: -31, longitude: -64 },
        { latitude: -32, longitude: -65 },
      ],
    ],
    controller.signal,
  );
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(requestSignal.aborted, true);
});
const { shortestVisitOrder, tourCost, optimizeCircuit, findBase, currentTaskCoordinates } = require('../src/services/optimized-circuit.ts');
const { assignPendingTask } = require('../src/services/assign-task.ts');

test('optimización exacta incluye retorno a base y respeta distancias asimétricas', () => {
  const matrix = [[0, 2, 9, 3], [8, 0, 1, 9], [1, 7, 0, 3], [9, 1, 6, 0]];
  const orders = [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]];
  const best = shortestVisitOrder(matrix);
  assert.equal(tourCost(best, matrix), Math.min(...orders.map(o => tourCost(o, matrix))));
  assert.deepEqual(best, [3,1,2]);
});
test('hojas grandes: no se pierden tareas y no empeora el orden original', () => {
  const matrix = Array.from({length: 16}, (_, i) => Array.from({length: 16}, (_, j) => i === j ? 0 : ((i*19+j*13)%23)+1));
  const baseline = Array.from({length:15}, (_,i)=>i+1);
  const order = shortestVisitOrder(matrix);
  assert.deepEqual([...order].sort((a,b)=>a-b), baseline);
  assert.ok(tourCost(order,matrix) <= tourCost(baseline,matrix));
  assert.deepEqual(shortestVisitOrder(matrix),order);
});
test('la base viene del origen EMEC real; ambigüedad o GPS faltante no inventan coordenadas', () => {
  const origin = {IdOrigen: 50, EmpresaInstitucion:'EMEC',Latitud:-31.4,Longitud:-64.1};
  assert.deepEqual(findBase([origin]), {latitude:-31.4,longitude:-64.1});
  assert.equal(findBase([]),null);
  assert.equal(findBase([origin,{...origin,IdOrigen:51}]),null);
  assert.equal(findBase([{...origin,Latitud:null}]),null);
  assert.equal(findBase([{...origin,EmpresaInstitucion:'Proveedor EMEC'}]),null);
});
test('las coordenadas actuales del origen reemplazan las anteriores sin convertir null a cero', () => {
  const task = {Id_Detalle_HDR:1,Id_Origen:10,Latitud:1,Longitud:1};
  const [updated] = currentTaskCoordinates([task],[{IdOrigen:10,Latitud:null,Longitud:null}]);
  assert.equal(updated.Latitud,null); assert.equal(task.Latitud,1);
});
const basePoint = {latitude:-31.4,longitude:-64.1};
const taskPoint = {Id_Detalle_HDR:1,Id_Origen:4,Id_HojaRuta:null,Latitud:-31.5,Longitud:-64.2};
test('circuito consulta matriz y geometría cerrada; no usa horarios', async () => {
  const urls=[];
  global.fetch=async (url)=>{
    urls.push(url);
    if(url.includes('/table/')) return Response.json({code:'Ok',distances:[[0,1000],[2000,0]]});
    return Response.json({code:'Ok',routes:[{distance:3000,duration:240,geometry:{coordinates:[[-64.1,-31.4],[-64.2,-31.5],[-64.1,-31.4]]}}]});
  };
  const result=await optimizeCircuit([taskPoint],basePoint);
  assert.equal(result.distance,3000); assert.equal(result.incomingKm[1],1);
  assert.match(urls[1],/-64.1,-31.4;-64.2,-31.5;-64.1,-31.4/);
});
test('circuito incompleto o matriz desconectada no presenta un total falso', async () => {
  let calls=0;global.fetch=async()=>{calls++;return Response.json({code:'Ok',distances:[[0,null],[2000,0]]})};
  await assert.rejects(optimizeCircuit([{...taskPoint,Latitud:null}],basePoint),/incompleto/);
  assert.equal(calls,0);
  await assert.rejects(optimizeCircuit([taskPoint],basePoint),/distancias/);
});
test('cancelar el cálculo propaga señal de aborto', async()=>{
  const controller=new AbortController();controller.abort();
  global.fetch=async(_,init)=>{init.signal.throwIfAborted()};
  await assert.rejects(optimizeCircuit([taskPoint],basePoint,controller.signal),{name:'AbortError'});
});
test('crear tarea envía hoja nula; asignación y total usan PATCH distintos',async()=>{
  const requests=[];global.fetch=async(url,init)=>{requests.push({url,method:init.method,data:JSON.parse(init.body)});return Response.json({})};
  await sitmasApi.crearParada({...taskPoint,Id_HojaRuta:null});
  await sitmasApi.asignarTarea(1,2,3.5,2);
  await sitmasApi.actualizarDistanciaTotal(2,15);
  assert.equal(requests[0].data.Id_HojaRuta,null);
  assert.deepEqual(requests[1].data,{IdHojaRuta:2,DistanciaTramo:3.5,IdEstadoAsignado:2});
  assert.match(requests[1].url,/1\/asignar$/);assert.equal(requests[1].method,'PATCH');
  assert.deepEqual(requests[2].data,{DistanciaTotal:15});
});
test('asignación no reenvía el PATCH si falla el guardado posterior de kilómetros',async()=>{
  let assignments=0;
  global.fetch=async(url,init)=>{
    if(url.endsWith('/pendientes'))return Response.json([taskPoint]);
    if(url.endsWith('/hojaruta/2') && !url.includes('detalle'))return Response.json({Id:2,Id_Estado:1});
    if(url.includes('/detallehojaruta/hojaruta/'))return Response.json(assignments?[{...taskPoint,Id_HojaRuta:2}]:[]);
    if(url.endsWith('/asignar')){assignments++;return Response.json({})}
    if(url.includes('/table/'))return Response.json({code:'Ok',distances:[[0,1000],[2000,0]]});
    if(url.includes('/route/'))return Response.json({code:'Ok',routes:[{distance:3000,duration:240,geometry:{coordinates:[[-64.1,-31.4],[-64.2,-31.5],[-64.1,-31.4]]}}]});
    if(url.endsWith('/distanciatotal'))return new Response('{}',{status:500});
    assert.fail(url+' '+init?.method);
  };
  const message=await assignPendingTask(1,2,2,[{IdOrigen:50,EmpresaInstitucion:'EMEC',Latitud:-31.4,Longitud:-64.1}]);
  assert.equal(assignments,1);assert.match(message,/Tarea asignada/);assert.match(message,/No se pudo actualizar/);
});
test('tarea ya asignada por otro operador no se vuelve a asignar',async()=>{
  global.fetch=async(url,init)=>{assert.notEqual(init?.method,'PATCH');return Response.json(url.endsWith('/hojaruta/2')&&!url.includes('detalle')?{Id:2}:[])};
  await assert.rejects(assignPendingTask(1,2,2,[]),/ya no está pendiente/);
});

test('la confirmación debe contener la tarea antes de anunciar una asignación exitosa', async () => {
  let assignments = 0;
  global.fetch = async (url) => {
    if (url.endsWith('/pendientes')) return Response.json([taskPoint]);
    if (url.endsWith('/hojaruta/2') && !url.includes('detalle')) return Response.json({ Id: 2, Id_Estado: 1 });
    if (url.includes('/detallehojaruta/hojaruta/')) return Response.json([]);
    if (url.endsWith('/asignar')) { assignments++; return Response.json({}); }
    assert.fail(url);
  };
  await assert.rejects(assignPendingTask(1, 2, 2, []), /no aparece en esta hoja/);
  assert.equal(assignments, 1);
});

test('trasladar recalcula ambas hojas y deja en cero la hoja vacía sin duplicar asignación', async () => {
  let moved = false, assignments = 0;
  const totals = new Map();
  global.fetch = async (url, init) => {
    if (/\/hojaruta\/[23]$/.test(url) && !url.includes('detalle')) return Response.json({ Id_Estado: 2 });
    if (url.endsWith('/detallehojaruta/hojaruta/3')) return Response.json(moved ? [] : [{ ...taskPoint, Id_HojaRuta: 3 }]);
    if (url.endsWith('/detallehojaruta/hojaruta/2')) return Response.json(moved ? [{ ...taskPoint, Id_HojaRuta: 2 }] : []);
    if (url.endsWith('/asignar')) { assignments++; moved = true; return Response.json({}); }
    if (url.includes('/table/')) return Response.json({ code: 'Ok', distances: [[0,1000],[2000,0]] });
    if (url.includes('/route/')) return Response.json({ code: 'Ok', routes: [{ distance:3000, duration:240, geometry:{coordinates:[[-64.1,-31.4],[-64.2,-31.5],[-64.1,-31.4]]} }] });
    if (url.endsWith('/distanciatotal')) { totals.set(Number(url.split('/').at(-2)), JSON.parse(init.body).DistanciaTotal); return Response.json({}); }
    assert.fail(url);
  };
  const result = await assignPendingTask(1, 2, 2, [{ IdOrigen:50, EmpresaInstitucion:'EMEC', Latitud:-31.4, Longitud:-64.1 }], 3);
  assert.match(result, /trasladada/); assert.equal(assignments, 1);
  assert.equal(totals.get(3), 0); assert.equal(totals.get(2), 3);
});

test('soltar en la misma hoja no vuelve a asignar ni suma kilómetros', async () => {
  global.fetch = async () => assert.fail('No debe enviar solicitudes');
  assert.match(await assignPendingTask(1, 2, 2, [], 2), /ya pertenece/);
});

test('eliminar la última tarea actualiza el total a cero incluso sin coordenadas EMEC', async () => {
  const { deleteTask } = require('../src/services/assign-task.ts');
  let deleted = false, total;
  global.fetch = async (url, init) => {
    if (url.endsWith('/hojaruta/2') && !url.includes('detalle')) return Response.json({ Id_Estado:2 });
    if (url.endsWith('/detallehojaruta/hojaruta/2')) return Response.json(deleted ? [] : [{ ...taskPoint, Id_HojaRuta:2 }]);
    if (url.endsWith('/detallehojaruta/1') && init.method === 'DELETE') { deleted = true; return Response.json({}); }
    if (url.endsWith('/distanciatotal')) { total = JSON.parse(init.body).DistanciaTotal; return Response.json({}); }
    assert.fail(url);
  };
  assert.match(await deleteTask(1, 2, []), /Tarea eliminada/);
  assert.equal(deleted, true); assert.equal(total, 0);
});

test('eliminar no borra una tarea que otro operador ya trasladó', async () => {
  const { deleteTask } = require('../src/services/assign-task.ts');
  global.fetch = async (url, init) => { assert.notEqual(init?.method, 'DELETE'); return Response.json(url.includes('detalle') ? [] : { Id_Estado:2 }); };
  await assert.rejects(deleteTask(1, 2, []), /La tarea cambió/);
});
