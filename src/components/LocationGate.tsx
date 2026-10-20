import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { Text } from './AppText';
import { Action, ui } from './route-board/BoardUI';
import { useSessionStore } from '../state/session-store';
import { isDriverRole, ownRoutes } from '../services/driver-routes';
import { syncTripLocation } from '../services/trip-location';
import { queries } from '../query/sitmas';

export default function LocationGate({ children }: { children: ReactNode }) {
  const session = useSessionStore(state => state.session);
  const driver = !!session && isDriverRole(session.rol);
  const routes = useQuery({ ...queries.hojas, enabled: driver, refetchInterval: 15000 });
  const trip = session && driver ? ownRoutes(routes.data ?? [], session).find(route => route.Id_Estado === 3) : undefined;
  const [status, setStatus] = useState({ checked: false, permission: false, services: false, background: false, canAsk: true, tick: 0 });
  const [error, setError] = useState('');
  const [trackingError, setTrackingError] = useState('');
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [busy, setBusy] = useState(false);
  const checking = useRef(false);
  const check = useCallback(async (request = false) => {
    if (checking.current) return;
    checking.current = true;
    try {
      const permission = request ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
      const services = await Location.hasServicesEnabledAsync();
      const background = permission.granted && (await Location.getBackgroundPermissionsAsync()).granted;
      setStatus({ checked: true, permission: permission.granted, services, background, canAsk: permission.canAskAgain, tick: Date.now() });
      setError('');
    } catch { setError('No se pudo comprobar la ubicación. Reintentá.'); }
    finally { checking.current = false; }
  }, []);
  useEffect(() => {
    void check(true);
    const listener = AppState.addEventListener('change', state => { setForeground(state === 'active'); if (state === 'active') void check(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void check(); }, 3000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [check]);
  useEffect(() => {
    if (!foreground || !status.checked || (driver && !routes.isSuccess)) return;
    const active = trip && session && status.permission && status.services && status.background
      ? { userId: session.idUsuario, routeId: trip.Id } : null;
    let disposed = false;
    void syncTripLocation(active).then(() => { if (!disposed) setTrackingError(''); })
      .catch(() => { if (!disposed) setTrackingError('No se pudo mantener la ubicación del viaje. Revisá los permisos y reintentá.'); });
    return () => { disposed = true; };
  }, [foreground, status, driver, routes.isSuccess, session, trip?.Id]);
  const ready = status.checked && status.permission && status.services && (!trip || status.background) && !error && !trackingError;
  async function enable() {
    if (busy) return;
    setBusy(true);
    try {
      if (!status.permission) {
        if (status.canAsk) await check(true); else await Linking.openSettings();
      } else if (!status.services) {
        if (Platform.OS === 'android') await Location.enableNetworkProviderAsync(); else await Linking.openSettings();
      } else if (trip && !status.background) {
        await Location.requestBackgroundPermissionsAsync();
      }
      await check();
    } catch { setError('Para usar SITMAS necesitás activar la ubicación y permitir su acceso.'); }
    finally { setBusy(false); }
  }
  return <>{children}<Modal visible={!ready} statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}}>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0054a6' }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 18, backgroundColor: '#eef7ec' }}>
        <Text accessibilityRole="header" style={ui.title}>Ubicación necesaria</Text>
        <Text style={ui.text}>{!status.checked ? 'Comprobando la ubicación del teléfono…' : !status.permission
          ? 'SITMAS necesita permiso de ubicación precisa para mostrar tu posición. Permití el acceso para continuar.'
          : !status.services ? 'La ubicación del teléfono está apagada. Encendé el GPS para utilizar SITMAS.'
          : trip && !status.background ? 'Tenés un viaje en curso. Permití la ubicación «todo el tiempo» para mantenerla al bloquear la pantalla o minimizar la app. Solo se registra el último punto en este teléfono durante el viaje.'
          : 'Revisá la ubicación del viaje para continuar.'}</Text>
        {!!(error || trackingError) && <Text accessibilityRole="alert" style={ui.error}>{error || trackingError}</Text>}
        {busy && <ActivityIndicator color="#087947" />}
        <Action title={!status.permission ? status.canAsk ? 'Permitir ubicación' : 'Abrir permisos' : !status.services ? 'Activar ubicación' : trip && !status.background ? 'Permitir ubicación durante el viaje' : 'Reintentar'} disabled={busy} onPress={() => { void enable(); }} />
        {session && <Action secondary title="Cerrar sesión" onPress={() => useSessionStore.getState().signOut()} />}
      </View>
    </SafeAreaView>
  </Modal></>;
}
