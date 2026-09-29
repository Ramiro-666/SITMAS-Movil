import type { Parada } from './sitmas-api';
import { validCoordinates } from '../components/maps/types';

export type Coordinate = { latitude: number; longitude: number };
export type RouteStop = {
  stop: Parada;
  number: number;
  coordinate: Coordinate | null;
};
export type RoadRoute = {
  paths: Coordinate[][];
  distance: number;
  duration: number;
};
function scheduledTime(stop: Parada) {
  const match = /^(\d{1,2}):(\d{2})/.exec(
    stop.HoraEstimadaFormateada || stop.HoraEstimada || '',
  );
  if (!match || +match[1] > 23 || +match[2] > 59) return Infinity;
  return +match[1] * 60 + +match[2];
}
export function orderStops(stops: Parada[]): RouteStop[] {
  return [...stops]
    .sort((a, b) => {
      const left = scheduledTime(a),
        right = scheduledTime(b);
      return (
        (left === right ? 0 : left - right) ||
        a.Id_Detalle_HDR - b.Id_Detalle_HDR
      );
    })
    .map((stop, index) => ({
      stop,
      number: index + 1,
      coordinate: validCoordinates(stop)
        ? { latitude: stop.Latitud!, longitude: stop.Longitud! }
        : null,
    }));
}
// Un punto sin GPS interrumpe el recorrido: no inventar un tramo que lo saltee.
export function routeSegments(points: RouteStop[]): Coordinate[][] {
  const segments: Coordinate[][] = [];
  let current: Coordinate[] = [];
  for (const point of points) {
    if (point.coordinate) current.push(point.coordinate);
    else {
      if (current.length > 1) segments.push(current);
      current = [];
    }
  }
  if (current.length > 1) segments.push(current);
  return segments;
}
export const routingEndpoint = (
  process.env.EXPO_PUBLIC_OSRM_URL || 'https://router.project-osrm.org'
).replace(/\/$/, '');
export async function fetchRoadRoute(
  segments: Coordinate[][],
  signal?: AbortSignal,
): Promise<RoadRoute> {
  const result: RoadRoute = { paths: [], distance: 0, duration: 0 };
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 20000);
  try {
    for (const segment of segments) {
      // Lotes con el extremo compartido; mantiene el orden en hojas largas.
      for (let start = 0; start < segment.length - 1; start += 24) {
        controller.signal.throwIfAborted();
        const points = segment.slice(start, start + 25);
        const coordinates = points
          .map((p) => `${p.longitude},${p.latitude}`)
          .join(';');
        const response = await fetch(
          `${routingEndpoint}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
          { signal: controller.signal },
        );
        if (!response.ok)
          throw new Error('No se pudo calcular el recorrido vial.');
        const data = await response.json();
        const route = data.routes?.[0];
        if (
          data.code !== 'Ok' ||
          !route ||
          !Array.isArray(route.geometry?.coordinates) ||
          route.geometry.coordinates.length < 2 ||
          !Number.isFinite(route.distance) ||
          !Number.isFinite(route.duration)
        ) {
          throw new Error(
            'No hay un recorrido vial disponible para estas paradas.',
          );
        }
        const path: Coordinate[] = route.geometry.coordinates.map(
          (pair: unknown) => {
            if (
              !Array.isArray(pair) ||
              !validCoordinates({ Latitud: pair[1], Longitud: pair[0] })
            )
              throw new Error('El servicio devolvió un recorrido inválido.');
            return { latitude: pair[1], longitude: pair[0] };
          },
        );
        result.paths.push(path);
        result.distance += route.distance;
        result.duration += route.duration;
      }
    }
    controller.signal.throwIfAborted();
    return result;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
