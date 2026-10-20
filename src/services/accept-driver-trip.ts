import { sitmasApi, type HojaRuta, type Session } from './sitmas-api';
import { ownRoutes } from './driver-routes';
import { getTripRecord, saveTripRecord } from '../state/trip-records';

export class TripWriteError extends Error {}

export async function acceptDriverTrip(route: HojaRuta, session: Session, start: number) {
  if (!Number.isFinite(start) || start < 0) throw new Error('Ingresá un odómetro inicial válido.');
  if (getTripRecord(session.idUsuario, route.Id)) throw new Error('Ya hay un inicio registrado para esta ruta. Revisá el viaje antes de reintentar.');
  const fresh = await sitmasApi.hojaRuta(route.Id);
  if (fresh.Id_Estado !== 2 || !fresh.Id_Vehiculo) throw new Error('La ruta ya no está disponible. Actualizá los datos.');
  const routes = await sitmasApi.hojasRuta();
  if (ownRoutes(routes, session).some((item) => item.Id_Estado === 3)) throw new Error('Ya tenés una ruta en curso.');
  // shortcut: el backend requiere dos escrituras; no reintentar si una pudo quedar guardada.
  try {
    const odometer = await sitmasApi.iniciarOdometro(fresh.Id_Vehiculo, route.Id, start);
    if (!Number.isInteger(odometer.IdRegistroOdomet) || odometer.IdRegistroOdomet <= 0) throw new Error('Sin confirmación de odómetro.');
    saveTripRecord({ userId: session.idUsuario, routeId: route.Id, vehicleId: fresh.Id_Vehiculo, odometerId: odometer.IdRegistroOdomet, start, phase: 'open' });
    await sitmasApi.aceptarRuta(route.Id, session.idUsuario);
    return odometer.IdRegistroOdomet;
  } catch {
    throw new TripWriteError('No se pudo confirmar el inicio completo. El odómetro puede haber quedado guardado. Actualizá y revisá el viaje con el administrador antes de reintentar.');
  }
}
