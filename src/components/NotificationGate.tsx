import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useSessionStore } from '../state/session-store';
import { isDriverRole } from '../services/driver-routes';
import { notificationPermission } from '../services/trip-notifications';
import { Text } from './AppText';
import { Action, ui } from './route-board/BoardUI';

export default function NotificationGate({ children }: { children: ReactNode }) {
  const session = useSessionStore(state => state.session);
  const driver = !!session && isDriverRole(session.rol);
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!driver) return;
    let disposed = false;
    async function check(request = false) {
      try {
        const allowed = await notificationPermission(request);
        if (disposed) return;
        setGranted(allowed);
        setError('');
      } catch { if (!disposed) setError('No se pudieron comprobar los permisos de notificaciones. Reintentá.'); }
    }
    void check(true);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    return () => { disposed = true; listener.remove(); };
  }, [driver, session?.idUsuario]);
  if (!driver || (granted && !error)) return children;
  return <View style={{ flex: 1, padding: 28, justifyContent: 'center', gap: 16 }}>
    <Text accessibilityRole="header" style={ui.title}>Notificaciones necesarias</Text>
    <Text style={ui.text}>Permití las notificaciones de SITMAS para recibir el aviso cuando un administrador finalice tu viaje. Son obligatorias para usar el perfil del chofer.</Text>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Action title={busy ? 'Comprobando…' : granted ? 'Reintentar' : 'Permitir notificaciones'} disabled={busy} onPress={() => {
      setBusy(true);
      void notificationPermission(true).then(async allowed => {
        setGranted(allowed);
        if (allowed) setError(''); else await Linking.openSettings();
      }).catch(() => setError('No se pudieron habilitar las notificaciones. Revisá los permisos.')).finally(() => setBusy(false));
    }} />
    <Action title="Cerrar sesión" secondary onPress={() => useSessionStore.getState().signOut()} />
  </View>;
}
