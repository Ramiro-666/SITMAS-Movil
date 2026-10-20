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

test('el ícono GPS se copia como drawable monocromo Bio para expo-location', async () => {
  const path = require('node:path');
  const { parseStringPromise } = require('xml2js');
  const projectRoot = path.resolve(__dirname, '..');
  const output = path.join(projectRoot, '.local');
  fs.mkdirSync(output, { recursive: true });
  const platformProjectRoot = fs.mkdtempSync(path.join(output, 'location-icon-test-'));
  const plugin = require('../plugins/with-location-notification-icon.cjs');
  const config = plugin({ name: 'SITMAS', slug: 'sitmas-movil' });
  await config.mods.android.dangerous({ ...config, modRequest: { projectRoot, platformProjectRoot } });
  const icon = fs.readFileSync(path.join(platformProjectRoot, 'app/src/main/res/drawable/notification_icon.xml'));
  assert.deepEqual(icon, fs.readFileSync(path.join(projectRoot, 'assets/images/sitmas/bio-notification.xml')));
  const parsed = await parseStringPromise(icon);
  assert.equal(parsed.vector.$['android:width'], '24dp');
  assert.equal(parsed.vector.group[0].path.length, 3);
  for (const item of parsed.vector.group[0].path) assert.equal(item.$['android:fillColor'], '#FFFFFFFF');
  assert.ok(JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'))).expo.plugins.includes('./plugins/with-location-notification-icon.cjs'));
});

test('el marcador nativo se vuelve a montar con su número nuevo al reordenar paradas', () => {
  const React = require('react');
  const source = fs.readFileSync(require.resolve('../src/components/maps/RouteCanvas.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const stubs = {
    react: { ...React, useEffect: () => {}, useState: () => [false, () => {}], useRef: () => ({ current: null }) },
    'react-native': { View: 'View', StyleSheet: { create: value => value, absoluteFill: {} } },
    'react-native-maps': { __esModule: true, default: 'MapView', Marker: 'Marker', Polyline: 'Polyline' },
    '../AppText': { Text: 'Text' }, './types': { CORDOBA: { latitude: -31.4, longitude: -64.2 } },
  };
  new Function('require', 'module', 'exports', compiled)(name => stubs[name] ?? require(name), module, module.exports);
  const Canvas = module.exports.default;
  const point = (id, number) => ({ stop: { Id_Detalle_HDR: id, Origen: `Parada ${id}` }, number, coordinate: { latitude: -31.4, longitude: -64.2 } });
  const markers = points => Canvas({ points, paths: [], selectedId: null, fitVersion: 0, onSelect: () => {} }).props.children.props.children[1];
  const before = markers([point(160, 1), point(161, 2)]);
  const after = markers([point(162, 1), point(161, 2), point(160, 3)]);
  assert.notEqual(before[0].key, after[2].key, 'El número nuevo debe invalidar la imagen nativa anterior');
  assert.equal(before[1].key, after[1].key, 'Una parada sin cambios conserva su marcador');
  assert.match(after[2].props.title, /^Tarea 3:/);
  assert.equal(after[2].props.children.props.children.props.children, 3);
});

test('finalizar sugiere odómetro entero hacia arriba y conserva un cierre ya confirmado', () => {
  const React = require('react');
  const source = fs.readFileSync(require.resolve('../src/components/DriverTripMap.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  for (const [distance, final, expected] of [[52670, undefined, '69676'], [52000, undefined, '69675'], [0, undefined, '69623'], [52670, 69675.67, '69675.67']]) {
    let stateIndex = 0, suggestion;
    const module = { exports: {} };
    const session = { idUsuario: 11 };
    const stubs = {
      react: { ...React, useState: initial => { const index = stateIndex++; return [index === 4 ? { distance } : initial, value => { if (index === 1) suggestion = value; }]; } },
      'react-native': { View: 'View' },
      '@tanstack/react-query': { useIsMutating: () => 0, useQuery: () => ({ data: { start: 69623, final } }) },
      '../state/trip-records': {}, '../services/finish-driver-trip': {},
      './AppText': { Text: 'Text', TextInput: 'Input' },
      './SelectField': { __esModule: true, default: 'Select' },
      './route-board/CircuitMap': { __esModule: true, default: 'Map' },
      './route-board/BoardUI': { Action: 'Action', BoardModal: 'Modal', ui: {} },
      '../query/sitmas': { keys: {}, queries: {}, useSitmasQuery: () => ({}), useSitmasMutation: () => ({}) },
      '../state/session-store': { useSessionStore: selector => selector({ session }) },
      '../services/spontaneous-stop': {},
    };
    new Function('require', 'module', 'exports', compiled)(name => stubs[name] ?? require(name), module, module.exports);
    const tree = module.exports.default({ route: { Id: 87, Id_Estado: 3 }, origins: [] });
    function findFinish(element) {
      if (!React.isValidElement(element)) return undefined;
      if (element.props.title === 'Finalizar viaje') return element;
      return React.Children.toArray(element.props.children).map(findFinish).find(Boolean);
    }
    const action = findFinish(tree);
    assert.ok(action); action.props.onPress();
    assert.equal(suggestion, expected);
  }
});

test('GPS de viaje inicia una vez, conserva el último punto local y se detiene al cerrar', async () => {
  const Module = require('node:module');
  const load = Module._load;
  const disk = new Map();
  let task, running = false, starts = 0, stops = 0, failStart = false;
  const location = {
    Accuracy: { High: 4 },
    hasStartedLocationUpdatesAsync: async () => running,
    startLocationUpdatesAsync: async (_, options) => { starts++; assert.ok(options.foregroundService.notificationTitle); if (failStart) throw new Error('Sin permiso'); running = true; },
    stopLocationUpdatesAsync: async () => { stops++; running = false; },
  };
  class File {
    constructor(...parts) { this.key = parts.join('/'); }
    get exists() { return disk.has(this.key); }
    create() { disk.set(this.key, ''); }
    write(value) { disk.set(this.key, value); }
    textSync() { return disk.get(this.key); }
    delete() { disk.delete(this.key); }
  }
  Module._load = function(name, ...args) {
    if (name === 'expo-location') return location;
    if (name === 'expo-task-manager') return { isTaskDefined: () => false, defineTask: (_, handler) => { task = handler; } };
    if (name === 'expo-file-system') return { File, Paths: { document: 'phone' } };
    return load.call(this, name, ...args);
  };
  const modulePath = require.resolve('../src/services/trip-location.ts');
  try {
    delete require.cache[modulePath];
    const { syncTripLocation } = require(modulePath);
    await syncTripLocation({ userId: 11, routeId: 84 });
    await syncTripLocation({ userId: 11, routeId: 84 });
    assert.equal(starts, 1);
    await task({ data: { locations: [{ timestamp: Date.now() + 1, coords: { latitude: -31.4, longitude: -64.1, accuracy: 8 } }] }, error: null });
    const point = JSON.parse(disk.get('phone/sitmas-last-trip-location.json'));
    assert.equal(point.routeId, 84); assert.equal(point.latitude, -31.4);
    await syncTripLocation(null);
    assert.equal(stops, 1); assert.equal(disk.size, 0);
    await task({ data: { locations: [{ timestamp: Date.now() + 2, coords: { latitude: -31.4, longitude: -64.1 } }] }, error: null });
    assert.equal(disk.size, 0);
    failStart = true;
    await assert.rejects(syncTripLocation({ userId: 11, routeId: 84 }), /Sin permiso/);
    assert.ok(!disk.has('phone/sitmas-location-trip.json'));
    failStart = false;
    await syncTripLocation({ userId: 11, routeId: 84 });
    assert.equal(running, true);
    await task({ data: {}, error: { code: 'LOCATION_UNAVAILABLE' } });
    await syncTripLocation({ userId: 11, routeId: 84 });
    assert.ok(!disk.has('phone/sitmas-location-error.txt'));
    await syncTripLocation(null);
  } finally { Module._load = load; delete require.cache[modulePath]; }
});

test('piloto Android declara el alcance del certificado y excluye configuración npm local', async () => {
  const path = require('node:path');
  const plugin = require('../plugins/with-lan-certificate.cjs');
  const projectRoot = path.resolve(__dirname, '..');
  const previous = process.env.EXPO_PUBLIC_SITMAS_API_URL;
  process.env.EXPO_PUBLIC_SITMAS_API_URL = 'https://192.168.100.2:8443/api';
  try {
    const output = path.join(projectRoot, '.local');
    fs.mkdirSync(output, { recursive: true });
    const platformProjectRoot = fs.mkdtempSync(path.join(output, 'network-config-test-'));
    const config = plugin({ name: 'SITMAS', slug: 'sitmas-movil' });
    await config.mods.android.dangerous({ ...config, modRequest: { projectRoot, platformProjectRoot } });
    const resources = path.join(platformProjectRoot, 'app/src/main/res');
    const xml = fs.readFileSync(path.join(resources, 'xml/sitmas_lan_network.xml'), 'utf8');
    assert.match(xml, /<domain includeSubdomains="false">192\.168\.100\.2<\/domain>/);
    assert.ok(!xml.includes('cleartextTrafficPermitted="true"'));
    assert.deepEqual(fs.readFileSync(path.join(resources, 'raw/sitmas_lan_ca.pem')), fs.readFileSync(path.join(projectRoot, 'assets/certificates/sitmas-lan-ca.pem')));
    assert.ok(fs.readFileSync(path.join(projectRoot, '.easignore'), 'utf8').split(/\r?\n/).includes('/.npmrc'));
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_SITMAS_API_URL;
    else process.env.EXPO_PUBLIC_SITMAS_API_URL = previous;
  }
});
afterEach(() => {
  require('../src/services/sitmas-api.ts').setSessionToken();
  require('../src/state/trip-records.ts').resetTripMemory();
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

test('invalidar hojas alcanza las tareas de ambas hojas y no invalida los catálogos', async () => {
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

test('los orígenes se consultan desde la API real de SITMAS', async () => {
  let requested;
  global.fetch = async (url) => { requested = url; return Response.json([]); };
  await sitmasApi.origenes();
  assert.ok(requested.endsWith('/api/origen'));
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

test('el recorrido funciona sin throwIfAborted como en React Native', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'throwIfAborted');
  Object.defineProperty(AbortSignal.prototype, 'throwIfAborted', { configurable: true, value: undefined });
  try {
    global.fetch = async (url) => url.includes('/table/')
      ? Response.json({ code: 'Ok', distances: [[0, 1000], [2000, 0]] })
      : Response.json({ code: 'Ok', routes: [{ distance: 3000, duration: 240, geometry: { coordinates: [[-64.1,-31.4],[-64.2,-31.5],[-64.1,-31.4]] } }] });
    const circuit = await optimizeCircuit([taskPoint], basePoint);
    assert.equal(circuit.distance, 3000);
    assert.equal(circuit.paths[0].length, 3);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(fetchRoadRoute([[basePoint, basePoint]], controller.signal), { name: 'AbortError' });
  } finally {
    Object.defineProperty(AbortSignal.prototype, 'throwIfAborted', descriptor);
  }
});
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

test('perfil logístico con varios roles y rutas propias', () => {
  const { isDriverRole, ownRoutes, routeDate } = require('../src/services/driver-routes.ts');
  assert.equal(isDriverRole('Operador, Operador-Logistica'), true);
  assert.equal(isDriverRole('Operador'), false);
  assert.equal(isDriverRole('Administrador'), false);
  assert.deepEqual(ownRoutes([{ Id: 1, ChoferNombreCompleto: 'Mauro Gerosa' },
    { Id: 2, ChoferNombreCompleto: 'Otro' }], { nombre: 'Mauro Gerosa' }).map(r => r.Id), [1]);
  assert.equal(routeDate({ HojaRutaFecha: '2026-10-13T00:00:00' }), '13/10/2026');
  assert.equal(routeDate({ FechaFormateada: '12/10/2026', HojaRutaFecha: '0001-01-01' }), '12/10/2026');
});

test('sesión envía Bearer en consultas y lo limpia al salir; login no envía token viejo', async () => {
  const headers = [];
  global.fetch = async (url, init) => {
    headers.push(init.headers.Authorization);
    return new Response(JSON.stringify(String(url).endsWith('Login')
      ? { idUsuario: 11, nombre: 'Mauro Gerosa', rol: 'Operador-Logistica', token: 'nuevo' } : []));
  };
  useSessionStore.getState().signIn({ idUsuario: 11, nombre: 'Mauro Gerosa', rol: 'Operador-Logistica', token: 'prueba' });
  await sitmasApi.rutasHoy();
  await sitmasApi.login('prueba', 'prueba');
  useSessionStore.getState().signOut();
  await sitmasApi.rutasHoy();
  assert.deepEqual(headers, ['Bearer prueba', undefined, undefined]);
});

test('login rechaza respuestas exitosas que no contienen una sesión válida', async () => {
  const { InvalidSessionError } = require('../src/services/sitmas-api.ts');
  for (const payload of [null, {}, { idUsuario: 0, nombre: 'Prueba', rol: 'Operador' },
    { idUsuario: 1, nombre: 'Prueba', rol: 'Operador', permisos: 'todos' }]) {
    global.fetch = async () => new Response(JSON.stringify(payload));
    await assert.rejects(sitmasApi.login('prueba', 'prueba'), InvalidSessionError);
  }
  const valid = { idUsuario: 1, nombre: 'Prueba', rol: 'Operador', permisos: [] };
  global.fetch = async () => new Response(JSON.stringify(valid));
  assert.deepEqual(await sitmasApi.login('prueba', 'prueba'), valid);
});

test('aceptación confirma ruta disponible antes de guardar odómetro y asignar', async () => {
  const { acceptDriverTrip } = require('../src/services/accept-driver-trip.ts');
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([String(url).split('/api/')[1], init.method]);
    if (String(url).endsWith('/hojaruta/82')) return Response.json({ Id: 82, Id_Estado: 2, Id_Vehiculo: 2 });
    if (String(url).endsWith('/hojaruta')) return Response.json([]);
    if (String(url).endsWith('/iniciar-ruta')) return Response.json({ IdRegistroOdomet: 123 });
    return Response.json({ Mensaje: 'Iniciado' });
  };
  assert.equal(await acceptDriverTrip({ Id: 82 }, { idUsuario: 11, nombre: 'Mauro Gerosa' }, 1000), 123);
  assert.deepEqual(calls.map(c => c[1]), [undefined, undefined, 'POST', 'PATCH']);
});

test('ruta tomada o valores inválidos no escriben; fallo parcial exige revisión', async () => {
  const { acceptDriverTrip, TripWriteError } = require('../src/services/accept-driver-trip.ts');
  global.fetch = async () => assert.fail('No debe consultar por valor inválido');
  await assert.rejects(acceptDriverTrip({ Id: 82 }, { idUsuario: 11, nombre: 'Mauro Gerosa' }, NaN), /válido/);
  global.fetch = async (url, init) => { assert.equal(init.method, undefined); return Response.json({ Id_Estado: 3 }); };
  await assert.rejects(acceptDriverTrip({ Id: 82 }, { idUsuario: 11, nombre: 'Mauro Gerosa' }, 1000), /disponible/);
  let writes = 0;
  global.fetch = async (url, init) => {
    if (String(url).endsWith('/hojaruta/82')) return Response.json({ Id_Estado: 2, Id_Vehiculo: 2 });
    if (String(url).endsWith('/hojaruta')) return Response.json([]);
    writes++;
    if (init.method === 'POST') return Response.json({ IdRegistroOdomet: 123 });
    return new Response('{}', { status: 500 });
  };
  await assert.rejects(acceptDriverTrip({ Id: 82 }, { idUsuario: 11, nombre: 'Mauro Gerosa' }, 1000), TripWriteError);
  assert.equal(writes, 2);
});

test('parada espontánea valida GPS y propiedad antes de escribir', async () => {
  const { saveSpontaneousStop } = require('../src/services/spontaneous-stop.ts');
  const draft = { description: 'Prueba', latitude: -31.4, longitude: -64.1, movement: 2, material: 0 };
  global.fetch = async () => assert.fail('GPS inválido no debe consultar');
  await assert.rejects(saveSpontaneousStop(83, { nombre: 'Mauro Gerosa' }, { ...draft, latitude: 100 }, () => {}), /GPS/);
  global.fetch = async (url, init) => { assert.equal(init.method, undefined); return Response.json(String(url).endsWith('/83') ? { Id_Estado: 3 } : [{ Id: 83, ChoferNombreCompleto: 'Otro' }]); };
  await assert.rejects(saveSpontaneousStop(83, { nombre: 'Mauro Gerosa' }, draft, () => {}), /tu viaje/);
});

test('parada espontánea reutiliza GPS guardado y se vincula al viaje en curso', async () => {
  const { saveSpontaneousStop } = require('../src/services/spontaneous-stop.ts');
  let writes = 0;
  global.fetch = async (url, init) => {
    if (String(url).endsWith('/hojaruta/83')) return Response.json({ Id_Estado: 3 });
    if (String(url).endsWith('/hojaruta')) return Response.json([{ Id: 83, ChoferNombreCompleto: 'Mauro Gerosa' }]);
    writes++;
    assert.equal(String(url).endsWith('/detallehojaruta'), true);
    const payload = JSON.parse(init.body);
    assert.equal(payload.Id_Ubicacion, 25);
    assert.equal(payload.Id_HojaRuta, 83);
    assert.equal(payload.Id_Estado, 3);
    assert.equal(payload.Latitud, -31.4);
    return Response.json({ IdDetalleGenerado: 300 });
  };
  assert.equal(await saveSpontaneousStop(83, { nombre: 'Mauro Gerosa' }, { description: 'Prueba', latitude: -31.4, longitude: -64.1, movement: 2, material: 0, locationId: 25 }, () => assert.fail('No duplicar GPS')), 300);
  assert.equal(writes, 1);
});

test('fallo de parada conserva la ubicación confirmada y exige revisión sin reintentos automáticos', async () => {
  const { saveSpontaneousStop, StopWriteError } = require('../src/services/spontaneous-stop.ts');
  let locationId, writes = 0;
  global.fetch = async (url) => {
    if (String(url).endsWith('/hojaruta/83')) return Response.json({ Id_Estado: 3 });
    if (String(url).endsWith('/hojaruta')) return Response.json([{ Id: 83, ChoferNombreCompleto: 'Mauro Gerosa' }]);
    writes++;
    return String(url).endsWith('/ubicaciongeografica') ? Response.json({ IdUbicacionGenerado: 25 }) : new Response('{}', { status: 500 });
  };
  await assert.rejects(saveSpontaneousStop(83, { nombre: 'Mauro Gerosa' }, { description: 'Prueba', latitude: -31.4, longitude: -64.1, movement: 2, material: 0 }, (id) => { locationId = id; }), StopWriteError);
  assert.equal(locationId, 25);
  assert.equal(writes, 2);
});

const tripSession = { idUsuario: 11, nombre: 'Mauro Gerosa' };
const tripRecord = { userId: 11, routeId: 84, vehicleId: 3, odometerId: 31, start: 1000, phase: 'open' };
const closureOrigins = [{ IdOrigen: 50, EmpresaInstitucion: 'EMEC', Latitud: -31.46, Longitud: -64.12, Id_Ubicacion: 25 }];
const closureTask = { Id_Detalle_HDR: 120, Id_HojaRuta: 84, Id_Origen: 4, Id_TipoMovimiento: 2, Id_Estado: 3, Latitud: -31.37, Longitud: -64.21 };
const returnTask = { ...closureTask, Id_Detalle_HDR: 121, Id_Origen: 50, Id_TipoMovimiento: 3, Id_Estado: 5, Latitud: -31.46, Longitud: -64.12 };
const closureCircuit = { tasks: [closureTask], distance: 20000, duration: 1000, paths: [], incomingKm: {}, method: 'exact' };
function mockClosingFetch({ failSheet = false, failOdometer = false, returnExists = true } = {}) {
  const writes = []; let closed = false;
  global.fetch = async (url, init) => {
    const path = String(url).split('/api/')[1];
    if (!init.method) {
      if (path === 'hojaruta/84') return Response.json({ Id: 84, Id_Vehiculo: 3, Id_Estado: closed ? 5 : 3 });
      if (path === 'hojaruta') return Response.json([{ Id: 84, ChoferNombreCompleto: 'Mauro Gerosa' }]);
      if (path === 'detallehojaruta/hojaruta/84') return Response.json(returnExists ? [closureTask, returnTask] : [closureTask]);
      if (String(url).includes('/route/v1/')) return Response.json({ code: 'Ok', routes: [{ distance: 10000, duration: 500, geometry: { coordinates: [[-64.21, -31.37], [-64.12, -31.46]] } }] });
      assert.fail(path);
    }
    writes.push(path);
    if (path === 'detallehojaruta') return Response.json({ IdDetalleGenerado: 121 });
    if (path.startsWith('registroodometro/finalizar-ruta')) return failOdometer ? new Response('{}', { status: 500 }) : Response.json({});
    if (path === 'hojaruta/84/finalizar') { if (failSheet) return new Response('{}', { status: 500 }); closed = true; return Response.json({}); }
    assert.fail(path);
  };
  return writes;
}

test('inicio conserva ID y odómetro para cerrar después de volver a abrir la app', async () => {
  const { getTripRecord } = require('../src/state/trip-records.ts');
  global.fetch = async (url) => {
    if (String(url).endsWith('/hojaruta/84')) return Response.json({ Id_Estado: 2, Id_Vehiculo: 3 });
    if (String(url).endsWith('/hojaruta')) return Response.json([]);
    return Response.json({ IdRegistroOdomet: 31 });
  };
  const { acceptDriverTrip } = require('../src/services/accept-driver-trip.ts');
  await acceptDriverTrip({ Id: 84 }, tripSession, 1000);
  assert.deepEqual(getTripRecord(11, 84), tripRecord);
  assert.equal(getTripRecord(2, 84), null);
});

test('cierre valida odómetro antes de escribir y confirma la hoja finalizada', async () => {
  const { saveTripRecord, getTripRecord } = require('../src/state/trip-records.ts');
  const { finishDriverTrip } = require('../src/services/finish-driver-trip.ts');
  saveTripRecord({ ...tripRecord });
  global.fetch = async () => assert.fail('Valor inválido no debe consultar');
  for (const final of [999, 1181, NaN]) await assert.rejects(finishDriverTrip(84, tripSession, final, closureCircuit, closureOrigins), /odómetro final/);
  const writes = mockClosingFetch();
  await finishDriverTrip(84, tripSession, 1020, closureCircuit, closureOrigins);
  assert.deepEqual(writes, ['registroodometro/finalizar-ruta/31', 'hojaruta/84/finalizar']);
  assert.equal(getTripRecord(11, 84), null);
});

test('cierre registra el retorno una vez antes de odómetro y hoja', async () => {
  const { saveTripRecord } = require('../src/state/trip-records.ts');
  const { finishDriverTrip } = require('../src/services/finish-driver-trip.ts');
  saveTripRecord({ ...tripRecord });
  const writes = mockClosingFetch({ returnExists: false });
  await finishDriverTrip(84, tripSession, 1020, closureCircuit, closureOrigins);
  assert.deepEqual(writes, ['detallehojaruta', 'registroodometro/finalizar-ruta/31', 'hojaruta/84/finalizar']);
});

test('si falla la hoja, reintentar no vuelve a cerrar odómetro ni requiere mapas', async () => {
  const { saveTripRecord, getTripRecord } = require('../src/state/trip-records.ts');
  const { finishDriverTrip } = require('../src/services/finish-driver-trip.ts');
  saveTripRecord({ ...tripRecord });
  mockClosingFetch({ failSheet: true });
  await assert.rejects(finishDriverTrip(84, tripSession, 1020, closureCircuit, closureOrigins), /odómetro quedó cerrado/);
  assert.equal(getTripRecord(11, 84).phase, 'odometer-closed');
  const writes = mockClosingFetch();
  await finishDriverTrip(84, tripSession, 1020, null, closureOrigins);
  assert.deepEqual(writes, ['hojaruta/84/finalizar']);
});

test('resultado incierto del odómetro bloquea el reenvío y evita duplicar consumo', async () => {
  const { saveTripRecord } = require('../src/state/trip-records.ts');
  const { finishDriverTrip, FinishTripUncertainError } = require('../src/services/finish-driver-trip.ts');
  saveTripRecord({ ...tripRecord });
  mockClosingFetch({ failOdometer: true });
  await assert.rejects(finishDriverTrip(84, tripSession, 1020, closureCircuit, closureOrigins), FinishTripUncertainError);
  const writes = mockClosingFetch();
  await assert.rejects(finishDriverTrip(84, tripSession, 1020, closureCircuit, closureOrigins), FinishTripUncertainError);
  assert.deepEqual(writes, []);
});

test('registro persistente se recupera al reiniciar y rechaza estados incompletos', () => {
  const { configureTripStorage, saveTripRecord, getTripRecord, resetTripMemory } = require('../src/state/trip-records.ts');
  const disk = new Map();
  const adapter = { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value), removeItem: key => disk.delete(key) };
  configureTripStorage(adapter);
  saveTripRecord({ ...tripRecord });
  resetTripMemory(); configureTripStorage(adapter);
  assert.deepEqual(getTripRecord(11, 84), tripRecord);
  saveTripRecord({ ...tripRecord, phase: 'odometer-closed' });
  assert.throws(() => getTripRecord(11, 84), /no es válido/);
});

test('recuperados semanales: lunes a domingo, solo procesados y pesos útiles', () => {
  const { recoveredThisWeek } = require('../src/services/recovered-materials.ts');
  const row = (FechaClasificacion, PesoUtil, EstadoMtCl = 'Procesado', MaterialOriginal = 'Madera - Tarimas') => ({ FechaClasificacion, PesoUtil, EstadoMtCl, MaterialOriginal });
  const report = recoveredThisWeek([
    row('2026-10-12T00:00:00', 2), row('2026-10-18T23:59:59', 3),
    row('2026-10-11T23:59:59', 100), row('2026-10-19T00:00:00', 100),
    row('2026-10-14T12:00:00', 100, 'Anulado'), row('2026-10-14T12:00:00', 0),
    row('2026-10-12T01:00:00Z', 100), row('2026-10-19T02:59:59Z', 4),
  ], new Date('2026-10-15T01:00:00Z'));
  assert.equal(report.inicio, '2026-10-12');
  assert.equal(report.fin, '2026-10-19');
  assert.equal(report.total, 9);
  assert.deepEqual(report.materiales, [{ material: 'Madera - Tarimas', kg: 9 }]);
  assert.equal(recoveredThisWeek([], new Date('2026-10-18T12:00:00Z')).inicio, '2026-10-12');
  assert.equal(recoveredThisWeek([], new Date('2026-10-19T12:00:00Z')).inicio, '2026-10-19');
  const now = new Date('2026-10-15T12:00:00Z');
  assert.throws(() => recoveredThisWeek([row('fecha inválida', 5)], now));
  assert.throws(() => recoveredThisWeek([row('2026-10-14', -1)], now));
});

test('la dona web renderiza sin propiedades DOM inválidas', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const rn = require('react-native-web');
  const Module = require('node:module');
  const load = Module._load;
  let svg;
  try {
    Module._load = function(name, ...args) { return name === 'react-native' ? rn : load.call(this, name, ...args); };
    svg = require('react-native-svg/lib/commonjs/elements.web');
  } finally { Module._load = load; }
  const source = fs.readFileSync(require.resolve('../src/components/RecoveredMaterials.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const output = {};
  const localRequire = (name) => {
    if (name === 'react-native') return rn;
    if (name === 'react-native-svg') return svg;
    if (name === './AppText') return { Text: rn.Text };
    if (name === '../query/sitmas') return { queries: { recuperados: {} }, useSitmasQuery: () => ({}) };
    return require(name);
  };
  new Function('require', 'exports', compiled)(localRequire, output);
  const warnings = [];
  const error = console.error;
  let html;
  try {
    console.error = (...args) => warnings.push(args.join(' '));
    html = renderToStaticMarkup(React.createElement(output.default));
  } finally { console.error = error; }
  assert.equal((html.match(/<circle/g) || []).length, 5);
  assert.match(html, /rotate\(-90 100 100\)/);
  assert.doesNotMatch(html, /accessibilityElementsHidden|transform-origin/);
  assert.deepEqual(warnings.filter((warning) => /does not recognize|Invalid DOM property/.test(warning)), []);
});

test('alerta de ayer: fecha prevista, sin hoja, sin inventar fechas antiguas', () => {
  const { previousDayTasks, validPlannedDate } = require('../src/services/pending-alert.ts');
  const yesterday = { Id_Detalle_HDR: 1, Id_HojaRuta: null, FechaPrevista: '2026-10-13T00:00:00' };
  assert.deepEqual(previousDayTasks([yesterday, { ...yesterday, Id_HojaRuta: 2 }, { ...yesterday, FechaPrevista: null }, { ...yesterday, FechaPrevista: '2026-10-14' }, { ...yesterday, FechaPrevista: '2026-10-12' }], new Date('2026-10-15T01:00:00Z')), [yesterday]);
  assert.equal(validPlannedDate('2026-02-30'), false);
  assert.equal(validPlannedDate('2026-10-13'), true);
  assert.equal(previousDayTasks([{ ...yesterday, FechaPrevista: '2026-09-30' }], new Date('2026-10-01T12:00:00Z')).length, 1);
});
