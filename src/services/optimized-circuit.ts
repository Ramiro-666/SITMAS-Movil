import { validCoordinates } from '../components/maps/types';
import { routingEndpoint, fetchRoadRoute, type Coordinate, type RoadRoute } from './route-geometry';
import type { CatalogItem, Parada } from './sitmas-api';

export type Circuit = RoadRoute & {
  tasks: Parada[];
  incomingKm: Record<number, number>;
  method: 'exact' | 'improved';
};
export function findBase(origins: CatalogItem[]): Coordinate | null {
  const candidates = origins.filter((o) => /^(sede\s+)?emec$/i.test(String(o.EmpresaInstitucion || '').trim()));
  if (candidates.length !== 1) return null;
  const origin = candidates[0];
  if (typeof origin.Latitud !== 'number' || typeof origin.Longitud !== 'number' || !validCoordinates({ Latitud: origin.Latitud, Longitud: origin.Longitud })) return null;
  return { latitude: origin.Latitud, longitude: origin.Longitud };
}
export function currentTaskCoordinates(tasks: Parada[], origins: CatalogItem[]): Parada[] {
  return tasks.map((task) => {
    const origin = origins.find((o) => Number(o.IdOrigen) === task.Id_Origen);
    return origin ? { ...task,
      Latitud: typeof origin.Latitud === 'number' ? origin.Latitud : null,
      Longitud: typeof origin.Longitud === 'number' ? origin.Longitud : null,
    } : task;
  }).sort((a, b) => a.Id_Detalle_HDR - b.Id_Detalle_HDR);
}
export function tourCost(order: number[], matrix: number[][]) {
  const circuit = [0, ...order, 0];
  return circuit.slice(1).reduce((sum, next, i) => sum + matrix[circuit[i]][next], 0);
}
// Matriz dirigida: una calle de una mano puede tener un costo distinto al regreso.
export function shortestVisitOrder(matrix: number[][]): number[] {
  const size = matrix.length;
  if (!size || matrix.some((row) => row.length !== size || row.some((d) => !Number.isFinite(d) || d < 0))) throw new Error('No hay conexiones viales válidas entre todas las tareas.');
  const n = size - 1;
  if (!n) return [];
  if (n <= 11) {
    const count = 1 << n;
    const dp = new Float64Array(count * n).fill(Infinity);
    const previous = new Int16Array(count * n).fill(-1);
    for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = matrix[0][j + 1];
    for (let mask = 1; mask < count; mask++) for (let end = 0; end < n; end++) {
      if (!(mask & (1 << end))) continue;
      const before = mask ^ (1 << end);
      if (!before) continue;
      for (let k = 0; k < n; k++) if (before & (1 << k)) {
        const cost = dp[before * n + k] + matrix[k + 1][end + 1];
        if (cost < dp[mask * n + end]) { dp[mask * n + end] = cost; previous[mask * n + end] = k; }
      }
    }
    let end = 0;
    const full = count - 1;
    for (let j = 1; j < n; j++) if (dp[full * n + j] + matrix[j + 1][0] < dp[full * n + end] + matrix[end + 1][0]) end = j;
    const order: number[] = [];
    let mask = full;
    while (end >= 0) { order.push(end + 1); const prior = previous[mask * n + end]; mask ^= 1 << end; end = prior; }
    return order.reverse();
  }
  let best = Array.from({ length: n }, (_, i) => i + 1);
  // Compara varios inicios y nunca empeora el orden estable de entrada.
  for (let first = 1; first <= n; first++) {
    const order = [first];
    const remaining = new Set(best.filter((i) => i !== first));
    while (remaining.size) {
      const last = order[order.length - 1];
      const next = [...remaining].sort((a, b) => matrix[last][a] - matrix[last][b] || a - b)[0];
      order.push(next); remaining.delete(next);
    }
    if (tourCost(order, matrix) < tourCost(best, matrix)) best = order;
  }
  for (let pass = 0; pass < 20; pass++) {
    let improved = false;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) {
      const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
      if (tourCost(candidate, matrix) + 0.001 < tourCost(best, matrix)) { best = candidate; improved = true; }
    }
    if (!improved) break;
  }
  return best;
}
export async function optimizeCircuit(tasks: Parada[], base: Coordinate, signal?: AbortSignal): Promise<Circuit> {
  if (tasks.length > 50) throw new Error('La optimización admite hasta 50 tareas por hoja.');
  if (tasks.some((task) => !validCoordinates(task))) throw new Error('Recorrido incompleto: hay tareas sin coordenadas. Completalas en SITMAS para optimizar toda la hoja.');
  if (!tasks.length) return { tasks: [], paths: [], distance: 0, duration: 0, incomingKm: {}, method: 'exact' };
  const sorted = [...tasks].sort((a, b) => a.Id_Detalle_HDR - b.Id_Detalle_HDR);
  const coordinates = [base, ...sorted.map((t) => ({ latitude: t.Latitud!, longitude: t.Longitud! }))];
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 25000);
  try {
    const response = await fetch(`${routingEndpoint}/table/v1/driving/${coordinates.map((p) => `${p.longitude},${p.latitude}`).join(';')}?annotations=distance`, { signal: controller.signal });
    if (!response.ok) throw new Error('No se pudo consultar las distancias viales. Reintentá.');
    const data = await response.json();
    if (data.code !== 'Ok' || !Array.isArray(data.distances) || data.distances.length !== coordinates.length || data.distances.some((row: unknown) => !Array.isArray(row) || row.length !== coordinates.length || row.some((v: unknown) => typeof v !== 'number' || !Number.isFinite(v) || v < 0))) throw new Error('El servicio no devolvió distancias para todas las tareas.');
    const order = shortestVisitOrder(data.distances);
    const ordered = order.map((i) => sorted[i - 1]);
    const road = await fetchRoadRoute([[base, ...order.map((i) => coordinates[i]), base]], controller.signal);
    const incomingKm: Record<number, number> = {};
    order.forEach((point, i) => { incomingKm[sorted[point - 1].Id_Detalle_HDR] = data.distances[i ? order[i - 1] : 0][point] / 1000; });
    return { ...road, tasks: ordered, incomingKm, method: tasks.length <= 11 ? 'exact' : 'improved' };
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
