import { sitmasApi, type Parada, type Ubicacion } from './sitmas-api';

type LocationDraft = Omit<Ubicacion, 'IdUbicacion'> & { IdUbicacion?: number };
// Las dos escrituras no son una transacción. Conservamos el ID creado para reintentar sin duplicar la ubicación.
export async function saveStopWithLocation(
  stop: Omit<Parada, 'Id_Detalle_HDR'> & { Id_Detalle_HDR?: number },
  location: LocationDraft | null,
  onLocationCreated: (location: Ubicacion) => void,
) {
  let locationId = location?.IdUbicacion ?? null;
  if (location && !locationId) {
    const { IdUbicacionGenerado } = await sitmasApi.crearUbicacion({
      Descripcion: location.Descripcion.trim(),
      Latitud: location.Latitud,
      Longitud: location.Longitud,
    });
    if (!Number.isInteger(IdUbicacionGenerado) || IdUbicacionGenerado <= 0)
      throw new Error('No se recibió el identificador de la ubicación.');
    locationId = IdUbicacionGenerado;
    onLocationCreated({ ...location, IdUbicacion: locationId });
  }
  const payload = {
    ...stop,
    Id_Ubicacion: locationId,
    Id_Origen: location ? 0 : stop.Id_Origen,
    Latitud: location?.Latitud ?? null,
    Longitud: location?.Longitud ?? null,
  };
  if (payload.Id_Detalle_HDR)
    return sitmasApi.actualizarParada({
      ...payload,
      Id_Detalle_HDR: payload.Id_Detalle_HDR,
    });
  return sitmasApi.crearParada(payload);
}
