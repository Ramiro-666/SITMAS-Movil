import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './AppText';
import { Action, BoardModal, ui } from './route-board/BoardUI';
import { acceptDriverTrip, TripWriteError } from '../services/accept-driver-trip';

import { keys, queries, useSitmasQuery, useSitmasMutation } from '../query/sitmas';
import { useSessionStore } from '../state/session-store';
import { ownRoutes, routeDate } from '../services/driver-routes';
import type { HojaRuta } from '../services/sitmas-api';
import QueryStatus from './QueryStatus';
import DriverTripMap from './DriverTripMap';
import { useIsMutating } from '@tanstack/react-query';
import { validCoordinates } from './maps/types';
import { currentTaskCoordinates } from '../services/optimized-circuit';

function RouteDetail({ route, onBack, backLabel = '‹ VOLVER A MIS RUTAS' }: { route: HojaRuta; onBack: () => void; backLabel?: string }) {
  const origins = useSitmasQuery(queries.origenes);
  const writing = useIsMutating() > 0;
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" disabled={writing} onPress={onBack}><Text style={styles.pending}>{backLabel}</Text></Pressable>
    <Text style={styles.title}>Ruta #{route.Id}</Text>
    <Text style={styles.subtitle}>{routeDate(route)} · {route.Vehiculo} · {route.Estado}</Text>
    <QueryStatus queries={[origins]} />
    {origins.isSuccess && <DriverTripMap route={route} origins={origins.data} />}
  </View>;
}
function AvailableTrip({ route, busy, onAccept }: { route: HojaRuta; busy: boolean; onAccept: () => void }) {
  const stops = useSitmasQuery(queries.paradas(route.Id));
  const origins = useSitmasQuery(queries.origenes);
  const tasks = currentTaskCoordinates(stops.data ?? [], origins.data ?? []);
  const ready = stops.isSuccess && origins.isSuccess && tasks.length > 0 && tasks.every(validCoordinates);
  return <View style={styles.card}>
    <Text style={styles.heading}>Ruta #{route.Id} · {route.Vehiculo}</Text>
    <Text style={styles.subtitle}>{routeDate(route)} · {tasks.length} paradas</Text>
    {tasks.map((stop) => <Text key={stop.Id_Detalle_HDR} style={styles.subtitle}>• {stop.Origen || 'Punto GPS'}</Text>)}
    {stops.isError || origins.isError ? <QueryStatus queries={[stops, origins]} /> : !ready && <Text style={styles.subtitle}>{stops.isPending || origins.isPending ? 'Verificando paradas…' : 'Requiere paradas con GPS antes de aceptar.'}</Text>}
    <Action title="Aceptar viaje" disabled={busy || !ready} onPress={onAccept} />
  </View>;
}
export default function ChoferDashboard() {
  const [tab, setTab] = useState<'hoy' | 'historial'>('hoy');
  const [selected, setSelected] = useState<HojaRuta | null>(null);
  const session = useSessionStore((state) => state.session)!;
  const [accepting, setAccepting] = useState<HojaRuta | null>(null);
  const [kilometers, setKilometers] = useState('');
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const odometers = useSitmasQuery(queries.odometrosVehiculo(accepting?.Id_Vehiculo ?? 0), !!accepting);
  const accept = useSitmasMutation((start: number) => acceptDriverTrip(accepting!, session, start), [keys.hojas, keys.odometros]);
  async function confirm() {
    if (!kilometers.trim() || blocked || accept.isPending) return;
    setError('');
    try { await accept.run(Number(kilometers.replace(',', '.'))); setAccepting(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo aceptar la ruta.'); if (reason instanceof TripWriteError) setBlocked(true); }
  }
  const today = useSitmasQuery(queries.hoy);
  const all = useSitmasQuery(queries.hojas);
  const own = ownRoutes(all.data ?? [], session);
  const active = own.filter((route) => route.Id_Estado === 3);
  const history = own.filter((route) => route.Id_Estado === 5);
  const available = (today.data ?? []).filter((route) => route.Id_Estado === 2);
  if (selected) return <RouteDetail route={selected} onBack={() => setSelected(null)} />;
  if (tab === 'hoy' && active.length) return <RouteDetail route={active[0]}
    backLabel="VER HISTORIAL ›" onBack={() => setTab('historial')} />;
  function routeCard(route: HojaRuta) {
    return <Pressable key={route.Id} accessibilityRole="button" accessibilityLabel={`Ver mapa y paradas de ruta ${route.Id}`}
      onPress={() => setSelected(route)} style={styles.card}>
      <Text style={styles.heading}>Ruta #{route.Id} · {route.Estado}</Text>
      <Text style={styles.subtitle}>{routeDate(route)} · {route.Vehiculo}</Text>
      <Text style={styles.pending}>VER MAPA Y PARADAS ›</Text>
    </Pressable>;
  }
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Viajes disponibles</Text>
      <QueryStatus queries={[today, all]} />
      <View style={styles.tabs}>
        {(['hoy', 'historial'] as const).map((item) => (
          <Pressable key={item} accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            onPress={() => setTab(item)}
            style={[styles.tab, tab === item && styles.selected]}>
            <Text style={[styles.label, tab === item && styles.selectedLabel]}>
              {item === 'hoy' ? 'Hoy' : 'Historial'}
            </Text>
          </Pressable>
        ))}
      </View>
      {accepting && <BoardModal title={`Aceptar ruta #${accepting.Id}`} busy={accept.isPending} onClose={() => { if (!accept.isPending) setAccepting(null); }}>
        <Text style={styles.subtitle}>{accepting.Vehiculo} · {routeDate(accepting)}</Text>
        <Text style={styles.subtitle}>Al confirmar, se te asignará este viaje y se abrirán su mapa y sus paradas.</Text>
        {odometers.isSuccess && !!odometers.data.length && <Text style={styles.subtitle}>Último odómetro: {odometers.data[0].FinalOdom} km</Text>}
        {odometers.isError && <Text style={styles.subtitle}>No se pudo consultar el odómetro anterior. Verificá el tablero del vehículo.</Text>}
        <Text style={styles.heading}>Odómetro inicial (km)</Text>
        <TextInput accessibilityLabel="Odómetro inicial" placeholder="Valor del tablero" keyboardType="decimal-pad" value={kilometers} onChangeText={setKilometers} editable={!accept.isPending && !blocked} style={ui.input} />
        {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
        <Action title={accept.isPending ? 'Confirmando…' : 'Confirmar y comenzar'} onPress={() => { void confirm(); }} disabled={!kilometers.trim() || accept.isPending || blocked} />
      </BoardModal>}
      {tab === 'hoy' ? <>
        <Text style={styles.heading}>Disponibles hoy ({available.length})</Text>
        {available.map((route) => <AvailableTrip key={route.Id} route={route} busy={accept.isPending || blocked}
          onAccept={() => { setAccepting(route); setKilometers(''); setError(''); }} />)}
        {today.isSuccess && !available.length && <Text style={styles.subtitle}>No hay rutas disponibles hoy.</Text>}
      </> : <>
        <Text style={styles.heading}>Finalizadas ({history.length})</Text>
        {history.map(routeCard)}
        {all.isSuccess && !history.length && <Text style={styles.subtitle}>Todavía no tenés rutas finalizadas.</Text>}
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, width: '100%', minWidth: 0 },
  eyebrow: { color: '#087a42', fontWeight: '800', fontSize: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#173d4c' },
  subtitle: { color: '#58717a', fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  tab: { flex: 1, padding: 13, borderRadius: 12, backgroundColor: '#e9f0f2', alignItems: 'center' },
  selected: { backgroundColor: '#087a42' },
  label: { color: '#173d4c', fontWeight: '700' },
  selectedLabel: { color: '#fff' },
  card: { padding: 18, gap: 9, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#dde8e5' },
  heading: { fontSize: 17, color: '#173d4c', fontWeight: '800' },
  pending: { color: '#087a42', fontWeight: '700', fontSize: 12 },
});
