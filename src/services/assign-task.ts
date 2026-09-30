import { sitmasApi, type CatalogItem } from './sitmas-api';
import { currentTaskCoordinates, findBase, optimizeCircuit } from './optimized-circuit';

export async function assignPendingTask(taskId: number, routeId: number, assignedState: number, origins: CatalogItem[], sourceId: number | null = null) {
  if (sourceId === routeId) return 'La tarea ya pertenece a esta hoja.';
  if (sourceId) {
    const source = await sitmasApi.hojaRuta(sourceId);
    if (source.Id_Estado && ![1, assignedState].includes(source.Id_Estado)) throw new Error('La hoja de origen ya no admite cambios.');
  }
  const [pending, header, existing] = await Promise.all([
    sourceId ? sitmasApi.detalleHojaRuta(sourceId) : sitmasApi.tareasPendientes(), sitmasApi.hojaRuta(routeId), sitmasApi.detalleHojaRuta(routeId),
  ]);
  const task = pending.find((t) => t.Id_Detalle_HDR === taskId && (t.Id_HojaRuta || null) === sourceId);
  if (!task) throw new Error(sourceId ? 'La tarea cambió de hoja. Actualizá el tablero.' : 'Esta tarea ya no está pendiente. Actualizá el tablero.');
  if (header.Id_Estado && header.Id_Estado !== 1 && header.Id_Estado !== assignedState) throw new Error('Solo se pueden asignar tareas a hojas pendientes o asignadas.');
  const base = findBase(origins);
  let incoming = 0;
  // La asignación es independiente del proveedor de mapas. Cero es el valor provisional de SITMAS.
  if (base) {
    try {
      const preview = await optimizeCircuit(currentTaskCoordinates([...existing, task], origins), base);
      incoming = Number((preview.incomingKm[taskId] || 0).toFixed(2));
    } catch { /* Se informará que los kilómetros quedaron pendientes. */ }
  }
  await sitmasApi.asignarTarea(taskId, routeId, incoming, assignedState);
  // No volver a llamar al endpoint de asignación para guardar kilómetros: ese SP suma al total.
  let confirmed;
  try { confirmed = await sitmasApi.detalleHojaRuta(routeId); }
  catch { throw new Error('SITMAS recibió la asignación, pero no pudimos comprobarla. Actualizá el tablero antes de reintentar.'); }
  if (!confirmed.some((t) => t.Id_Detalle_HDR === taskId)) throw new Error('La tarea no aparece en esta hoja. Actualizá el tablero para comprobar su asignación actual.');
  const failed = await refreshRouteTotals(sourceId ? [sourceId, routeId] : [routeId], origins);
  const success = sourceId ? 'Tarea trasladada.' : 'Tarea asignada.';
  return failed.length ? `${success} No se pudo actualizar el total de HR ${failed.join(', ')}; abrí «Ver en mapa» para recalcular y guardar los kilómetros.` : `${success} Circuito recalculado y total guardado.`;
}

async function refreshRouteTotals(ids: number[], origins: CatalogItem[]) {
  const base = findBase(origins);
  const failed: number[] = [];
  await Promise.all(ids.map(async (id) => {
    try {
      const tasks = currentTaskCoordinates(await sitmasApi.detalleHojaRuta(id), origins);
      if (tasks.length && !base) throw new Error('Falta EMEC');
      const distance = tasks.length ? (await optimizeCircuit(tasks, base!)).distance : 0;
      await sitmasApi.actualizarDistanciaTotal(id, Number((distance / 1000).toFixed(2)));
    } catch { failed.push(id); }
  }));
  return failed.sort((a, b) => a - b);
}

export async function deleteTask(taskId: number, sourceId: number | null, origins: CatalogItem[]) {
  if (sourceId) {
    const header = await sitmasApi.hojaRuta(sourceId);
    if (header.Id_Estado && ![1, 2].includes(header.Id_Estado)) throw new Error('La hoja ya no admite cambios.');
  }
  const current = sourceId ? await sitmasApi.detalleHojaRuta(sourceId) : await sitmasApi.tareasPendientes();
  if (!current.some((t) => t.Id_Detalle_HDR === taskId && (t.Id_HojaRuta || null) === sourceId)) throw new Error('La tarea cambió. Actualizá el tablero antes de eliminarla.');
  await sitmasApi.borrarParada(taskId);
  const failed = sourceId ? await refreshRouteTotals([sourceId], origins) : [];
  return failed.length ? `Tarea eliminada. No se pudo actualizar el total de HR ${sourceId}; recalculalo desde «Ver en mapa».` : 'Tarea eliminada. Recorrido actualizado.';
}
