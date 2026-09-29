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

const {
  orderStops,
  routeSegments,
  fetchRoadRoute,
} = require('../src/services/route-geometry.ts');
const routeStop = (id, hour, lat = -31.4167, lon = -64.1833) => ({
  Id_Detalle_HDR: id,
  Id_HojaRuta: 1,
  HoraEstimada: hour,
  Latitud: lat,
  Longitud: lon,
});
test('recorrido ordena por horario e ID sin mutar las paradas; horarios inválidos al final', () => {
  const stops = [
    routeStop(4, 'mal'),
    routeStop(3, '09:00'),
    routeStop(2, '08:00'),
    routeStop(1, '08:00'),
  ];
  const ordered = orderStops(stops);
  assert.deepEqual(
    ordered.map((p) => p.stop.Id_Detalle_HDR),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    ordered.map((p) => p.number),
    [1, 2, 3, 4],
  );
  assert.equal(stops[0].Id_Detalle_HDR, 4);
});
test('paradas sin GPS no se convierten en cero ni se saltean al dibujar tramos', () => {
  const points = orderStops([
    routeStop(1, '08:00'),
    routeStop(2, '09:00', null, null),
    routeStop(3, '10:00'),
    routeStop(4, '11:00'),
    routeStop(5, '12:00', 999, -64),
  ]);
  assert.equal(points[1].coordinate, null);
  assert.equal(points[4].coordinate, null);
  assert.deepEqual(routeSegments(points), [
    [points[2].coordinate, points[3].coordinate],
  ]);
  assert.deepEqual(routeSegments([]), []);
  assert.deepEqual(routeSegments([points[0]]), []);
});
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
