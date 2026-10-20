import { sitmasApi, type Session } from './sitmas-api';
import { ownRoutes } from './driver-routes';
import { validCoordinates } from '../components/maps/types';

export type SpontaneousStop = {
  description: string; latitude: number; longitude: number;
  movement: number; material: number; locationId?: number;
};
export class StopWriteError extends Error {}

export async function saveSpontaneousStop(routeId: number, session: Session, draft: SpontaneousStop, onLocationSaved: (id: number) => void) {
  if (!draft.description.trim() || !validCoordinates({ Latitud: draft.latitude, Longitud: draft.longitude })) throw new Error('Ingresá una referencia y coordenadas GPS válidas.');
  if (!Number.isInteger(draft.movement) || draft.movement <= 0 || !Number.isInteger(draft.material) || draft.material < 0) throw new Error('Elegí movimiento y material.');
  if (draft.locationId !== undefined && (!Number.isInteger(draft.locationId) || draft.locationId <= 0)) throw new Error('Ubicación guardada inválida.');
  const header = await sitmasApi.hojaRuta(routeId);
  const routes = await sitmasApi.hojasRuta();
  if (header.Id_Estado !== 3 || !ownRoutes(routes, session).some((route) => route.Id === routeId)) throw new Error('Solo podés agregar paradas a tu viaje en curso.');
  let locationId = draft.locationId;
  if (!locationId) {
    const location = await sitmasApi.crearUbicacion(draft.description.trim(), draft.latitude, draft.longitude);
    locationId = location.IdUbicacionGenerado;
    if (!Number.isInteger(locationId) || locationId <= 0) throw new Error('La API no confirmó la ubicación.');
    onLocationSaved(locationId);
  }
  // shortcut: GPS y parada se guardan por separado; exigir revisión ante un resultado incierto.
  try {
    const result = await sitmasApi.crearParada({ Id_HojaRuta: routeId, Id_TipoMovimiento: draft.movement, Id_TipoMaterial: draft.material, Id_Origen: 0, Id_RecursoMov: 0, Id_Ubicacion: locationId, Latitud: draft.latitude, Longitud: draft.longitude, Id_Estado: 3, HoraEstimada: '00:00:00', DistanciaDesdeAnterior_Km: 0 });
    if (!Number.isInteger(result.IdDetalleGenerado) || result.IdDetalleGenerado <= 0) throw new Error('Sin confirmación de parada.');
    return result.IdDetalleGenerado;
  } catch { throw new StopWriteError('No se pudo confirmar la parada. Actualizá el recorrido y revisá si quedó guardada antes de reintentar.'); }
}
