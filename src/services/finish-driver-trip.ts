import { sitmasApi, type CatalogItem, type Session } from './sitmas-api';
import { ownRoutes } from './driver-routes';
import { currentTaskCoordinates, findBase, type Circuit } from './optimized-circuit';
import { fetchRoadRoute } from './route-geometry';
import { clearTripRecord, getTripRecord, saveTripRecord } from '../state/trip-records';

export class FinishTripUncertainError extends Error {}

export async function finishDriverTrip(routeId: number, session: Session, final: number, circuit: Circuit | null, origins: CatalogItem[]) {
  const record = getTripRecord(session.idUsuario, routeId);
  if (!record) throw new Error('No se encontró el odómetro de este viaje en la app. Revisalo con el administrador.');
  if (!Number.isFinite(final) || final <= 0 || final < record.start || final - record.start > 180) throw new Error(`El odómetro final debe ser mayor o igual a ${record.start} y el recorrido no debe superar 180 km.`);
  const header = await sitmasApi.hojaRuta(routeId);
  const routes = await sitmasApi.hojasRuta();
  if (!ownRoutes(routes, session).some((route) => route.Id === routeId)) throw new Error('La ruta no pertenece a tu sesión.');
  if (header.Id_Estado === 5) { clearTripRecord(session.idUsuario, routeId); return; }
  if (header.Id_Estado !== 3 || header.Id_Vehiculo !== record.vehicleId) throw new Error('El viaje ya no está en curso o cambió de vehículo.');
  if (record.phase === 'closing-odometer') throw new FinishTripUncertainError('El cierre del odómetro quedó sin confirmación. No lo reenvíes: el administrador debe revisar si ya se registró el consumo.');
  if (record.phase === 'odometer-closed' && final !== record.final) throw new Error('El odómetro ya fue cerrado. Conservá el valor final confirmado para completar la hoja.');

  if (record.phase !== 'odometer-closed') {
    if (!circuit) throw new Error('Actualizá el recorrido antes de finalizar.');
    const baseOrigin = origins.filter((origin) => /^(sede\s+)?emec$/i.test(String(origin.EmpresaInstitucion || '').trim()));
    const base = findBase(origins);
    if (!base || baseOrigin.length !== 1 || !Number(baseOrigin[0].IdOrigen)) throw new Error('Falta una sede EMEC con GPS válido.');
    const baseId = Number(baseOrigin[0].IdOrigen);
    const details = await sitmasApi.detalleHojaRuta(routeId);
    const returns = details.filter((stop) => stop.Id_Origen === baseId && stop.Id_TipoMovimiento === 3 && stop.Id_Estado === 5);
    if (returns.length > 1) throw new Error('Hay varios retornos registrados. Revisá el viaje antes de cerrar.');
    if (record.phase === 'saving-return') {
      if (!returns.length) throw new FinishTripUncertainError('El retorno quedó sin confirmación. Revisá las paradas con el administrador antes de reintentar.');
      record.returnId = returns[0].Id_Detalle_HDR; record.phase = 'open'; saveTripRecord(record);
    }
    const withoutReturn = (tasks: typeof details) => tasks.filter((task) => !(task.Id_Origen === baseId && task.Id_TipoMovimiento === 3 && task.Id_Estado === 5));
    const fingerprint = (tasks: typeof details) => JSON.stringify([...tasks].sort((a, b) => a.Id_Detalle_HDR - b.Id_Detalle_HDR).map((task) => [task.Id_Detalle_HDR, task.Latitud, task.Longitud]));
    if (!Number.isFinite(circuit.distance) || circuit.distance < 0 || fingerprint(currentTaskCoordinates(withoutReturn(details), origins)) !== fingerprint(withoutReturn(circuit.tasks))) throw new Error('Las paradas cambiaron. Actualizá el recorrido antes de finalizar.');
    record.final = final; record.distanceKm = Number((circuit.distance / 1000).toFixed(2));
    if (!returns.length && !record.returnId && circuit.tasks.length) {
      const last = circuit.tasks[circuit.tasks.length - 1];
      if (typeof last.Latitud !== 'number' || typeof last.Longitud !== 'number') throw new Error('La última parada no tiene GPS.');
      const leg = await fetchRoadRoute([[{ latitude: last.Latitud, longitude: last.Longitud }, base]]);
      record.phase = 'saving-return'; saveTripRecord(record);
      try {
        const result = await sitmasApi.crearParada({ Id_HojaRuta: routeId, Id_TipoMovimiento: 3, Id_RecursoMov: 0, Id_Origen: baseId, Id_TipoMaterial: 0, Id_Estado: 5, Id_Ubicacion: Number(baseOrigin[0].Id_Ubicacion) || null, Latitud: base.latitude, Longitud: base.longitude, HoraEstimada: new Date().toTimeString().slice(0, 8), DistanciaDesdeAnterior_Km: Number((leg.distance / 1000).toFixed(2)) });
        if (!Number.isInteger(result.IdDetalleGenerado) || result.IdDetalleGenerado <= 0) throw new Error('Sin confirmación de retorno.');
        record.returnId = result.IdDetalleGenerado; record.phase = 'open'; saveTripRecord(record);
      } catch { throw new FinishTripUncertainError('No se pudo confirmar el retorno. Actualizá las paradas antes de intentar otro cierre.'); }
    }
    record.phase = 'closing-odometer'; saveTripRecord(record);
    try { await sitmasApi.finalizarOdometro(record.odometerId, final); }
    catch { throw new FinishTripUncertainError('No se pudo confirmar el cierre del odómetro. No lo reenvíes: revisá el registro con el administrador.'); }
    record.phase = 'odometer-closed'; saveTripRecord(record);
  }
  if (record.distanceKm === undefined) throw new Error('Falta la distancia confirmada del cierre.');
  try { await sitmasApi.finalizarRuta(routeId, record.distanceKm); }
  catch {
    const fresh = await sitmasApi.hojaRuta(routeId).catch(() => null);
    if (fresh?.Id_Estado !== 5) throw new Error('El odómetro quedó cerrado, pero falta finalizar la hoja. Reintentá Finalizar viaje con el mismo valor; el consumo no se volverá a enviar.');
  }
  const confirmed = await sitmasApi.hojaRuta(routeId);
  if (confirmed.Id_Estado !== 5) throw new Error('La API no confirmó la hoja finalizada. Actualizá y reintentá el cierre de la hoja.');
  clearTripRecord(session.idUsuario, routeId);
}
