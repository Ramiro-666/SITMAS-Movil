export function medirInclinacion({ x, y, z }: { x: number; y: number; z: number }): number | null {
  if (![x, y, z].every(Number.isFinite)) return null;
  const fuerza = Math.hypot(x, y, z);
  // Sin suficiente gravedad en el plano de la pantalla, la inclinación lateral no es fiable.
  if (fuerza < 0.75 || fuerza > 1.25 || Math.hypot(x, y) < 0.35) return null;
  return Math.round(Math.atan2(x, Math.abs(y)) * 180 / Math.PI);
}
