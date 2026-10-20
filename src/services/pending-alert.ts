export function validPlannedDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function previousDayTasks<T extends { Id_HojaRuta: number | null; FechaPrevista?: string | null }>(tasks: T[], now = new Date()) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  const yesterday = date.toISOString().slice(0, 10);
  return tasks.filter((task) => !task.Id_HojaRuta && task.FechaPrevista?.slice(0, 10) === yesterday);
}
