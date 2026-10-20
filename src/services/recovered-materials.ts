type ClassifiedMaterial = { FechaClasificacion: string; PesoUtil: number; EstadoMtCl: string; MaterialOriginal: string };
const argentinaDate = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function recoveredThisWeek(rows: ClassifiedMaterial[], now = new Date()) {
  if (!Array.isArray(rows)) throw new Error('Respuesta de clasificación inválida.');
  const monday = new Date(`${argentinaDate(now)}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const inicio = monday.toISOString().slice(0, 10);
  monday.setUTCDate(monday.getUTCDate() + 7);
  const fin = monday.toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.EstadoMtCl !== 'Procesado') continue;
    if (typeof row.FechaClasificacion !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(row.FechaClasificacion) || !Number.isFinite(Date.parse(row.FechaClasificacion))) throw new Error('Fecha de clasificación inválida.');
    // SQL devuelve fechas locales sin zona; las fechas con zona se convierten a Argentina.
    const date = /(?:Z|[+-]\d{2}:\d{2})$/.test(row.FechaClasificacion) ? argentinaDate(new Date(row.FechaClasificacion)) : row.FechaClasificacion.slice(0, 10);
    if (date < inicio || date >= fin) continue;
    if (typeof row.PesoUtil !== 'number' || !Number.isFinite(row.PesoUtil) || row.PesoUtil < 0 || typeof row.MaterialOriginal !== 'string' || !row.MaterialOriginal.trim()) throw new Error('Material o peso útil inválido.');
    if (row.PesoUtil === 0) continue;
    const label = row.MaterialOriginal.trim();
    counts.set(label, (counts.get(label) ?? 0) + row.PesoUtil);
  }
  const materiales = [...counts].map(([material, kg]) => ({ material, kg })).sort((a, b) => b.kg - a.kg);
  return { inicio, fin, materiales, total: materiales.reduce((sum, row) => sum + row.kg, 0) };
}
