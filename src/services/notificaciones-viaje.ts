import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
export async function permisoNotificaciones(request = false) {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('viajes', { name: 'Estado de los viajes', importance: Notifications.AndroidImportance.HIGH });
  const current = await Notifications.getPermissionsAsync();
  const permission = request && !current.granted && current.canAskAgain ? await Notifications.requestPermissionsAsync() : current;
  return permission.granted;
}
export async function notificarFinViaje(routeId: number, eventId: string) {
  if (!await permisoNotificaciones()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: eventId,
    content: { title: 'SITMAS · viaje finalizado', body: `La ruta #${routeId} fue finalizada por un administrador.`, sound: 'default', data: { routeId } },
    trigger: Platform.OS === 'android' ? { channelId: 'viajes' } : null,
  });
}
const seenFile = (userId: number) => new File(Paths.document, `sitmas-trip-alert-${userId}.txt`);
export function ultimoAvisoViaje(userId: number) { const file = seenFile(userId); return file.exists ? file.textSync() : null; }
export function marcarAvisoViaje(userId: number, id: string) { const file = seenFile(userId); if (!file.exists) file.create(); file.write(id); }
