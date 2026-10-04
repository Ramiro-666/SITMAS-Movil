export const CORDOBA = { latitude: -31.4167, longitude: -64.1833 };
export function validCoordinates(point: {
  Latitud?: number | null;
  Longitud?: number | null;
}) {
  return (
    typeof point.Latitud === 'number' &&
    Number.isFinite(point.Latitud) &&
    Math.abs(point.Latitud) <= 90 &&
    typeof point.Longitud === 'number' &&
    Number.isFinite(point.Longitud) &&
    Math.abs(point.Longitud) <= 180
  );
}
