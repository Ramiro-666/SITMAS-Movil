import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { File, Paths } from 'expo-file-system';
import { validCoordinates } from '../components/maps/types';

export const TRIP_LOCATION_TASK = 'sitmas-active-trip-location';
type TrackedTrip = { userId: number; routeId: number };
const activeFile = () => new File(Paths.document, 'sitmas-location-trip.json');
const positionFile = () => new File(Paths.document, 'sitmas-last-trip-location.json');
const errorFile = () => new File(Paths.document, 'sitmas-location-error.txt');
function write(file: File, content: string) { if (!file.exists) file.create(); file.write(content); }

if (!TaskManager.isTaskDefined(TRIP_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TRIP_LOCATION_TASK, async ({ data, error }) => {
    if (error) { write(errorFile(), 'No se pudo actualizar la ubicación del viaje. Revisá el GPS.'); return; }
    const file = activeFile();
    if (!file.exists) return;
    const trip = JSON.parse(file.textSync()) as TrackedTrip & { startedAt: number };
    const locations = data?.locations;
    const position = locations?.[locations.length - 1];
    if (!position || !Number.isFinite(position.timestamp) || position.timestamp < trip.startedAt ||
        !validCoordinates({ Latitud: position.coords.latitude, Longitud: position.coords.longitude })) return;
    // Solo conservamos el último punto del viaje en el teléfono; no se envía al backend.
    write(positionFile(), JSON.stringify({ ...trip, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp }));
    if (errorFile().exists) errorFile().delete();
  });
}

// Serializar inicio/fin evita dejar el servicio activo si cambia la sesión durante una solicitud.
let pending: Promise<void> = Promise.resolve();
export function syncTripLocation(trip: TrackedTrip | null): Promise<void> {
  pending = pending.catch(() => {}).then(async () => {
    const active = activeFile();
    const current = active.exists ? JSON.parse(active.textSync()) as TrackedTrip : null;
    const running = await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK);
    if (trip && running && !errorFile().exists && current?.userId === trip.userId && current?.routeId === trip.routeId) return;
    if (running) await Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK);
    for (const file of [active, positionFile(), errorFile()]) if (file.exists) file.delete();
    if (!trip) return;
    write(active, JSON.stringify({ ...trip, startedAt: Date.now() }));
    try {
      await Location.startLocationUpdatesAsync(TRIP_LOCATION_TASK, {
        accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000,
        pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'SITMAS · viaje en curso',
          notificationBody: 'Ubicación activa durante el viaje. Mantené el GPS encendido.',
          notificationColor: '#087947', killServiceOnDestroy: true,
        },
      });
    } catch (error) {
      if (active.exists) active.delete();
      throw error;
    }
  });
  return pending;
}
