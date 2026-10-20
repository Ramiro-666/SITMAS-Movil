import { useState } from 'react';
import { View } from 'react-native';
import { useIsMutating, useQuery } from '@tanstack/react-query';
import { getTripRecord } from '../state/trip-records';
import { finishDriverTrip, FinishTripUncertainError } from '../services/finish-driver-trip';
import type { Circuit } from '../services/optimized-circuit';
import { Text, TextInput } from './AppText';
import SelectField from './SelectField';
import CircuitMap from './route-board/CircuitMap';
import { Action, BoardModal, ui } from './route-board/BoardUI';
import { keys, queries, useSitmasMutation, useSitmasQuery } from '../query/sitmas';
import { useSessionStore } from '../state/session-store';
import { saveSpontaneousStop, StopWriteError } from '../services/spontaneous-stop';
import type { CatalogItem, HojaRuta } from '../services/sitmas-api';
import type { Coordinate } from '../services/route-geometry';

export default function DriverTripMap({ route, origins }: { route: HojaRuta; origins: CatalogItem[] }) {
  const session = useSessionStore((state) => state.session)!;
  const writing = useIsMutating() > 0;
  const [finishing, setFinishing] = useState(false);
  const [finalValue, setFinalValue] = useState('');
  const [finishError, setFinishError] = useState('');
  const [finishBlocked, setFinishBlocked] = useState(false);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const trip = useQuery({ queryKey: ['tripRecord', session.idUsuario, route.Id], queryFn: () => getTripRecord(session.idUsuario, route.Id), retry: false, enabled: route.Id_Estado === 3 });
  const finish = useSitmasMutation((final: number) => finishDriverTrip(route.Id, session, final, circuit, origins), [keys.hojas, keys.odometros, ['tripRecord', session.idUsuario, route.Id]]);
  async function confirmFinish() {
    if (writing || finishBlocked || (!circuit && trip.data?.phase !== 'odometer-closed') || !finalValue.trim()) return;
    setFinishError('');
    try { await finish.run(Number(finalValue.replace(',', '.'))); setFinishing(false); }
    catch (error) { setFinishError(error instanceof Error ? error.message : 'No se pudo finalizar.'); if (error instanceof FinishTripUncertainError) setFinishBlocked(true); }
  }
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [movement, setMovement] = useState(0);
  const [material, setMaterial] = useState(0);
  const [locationId, setLocationId] = useState<number>();
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState('');
  const movements = useSitmasQuery(queries.movimientos, open);
  const materials = useSitmasQuery(queries.materiales, open);
  const save = useSitmasMutation(async () => {
    if (!latitude.trim() || !longitude.trim()) throw new Error('Marcá un punto en el mapa o completá ambas coordenadas.');
    return saveSpontaneousStop(route.Id, session, { description, latitude: Number(latitude.replace(',', '.')), longitude: Number(longitude.replace(',', '.')), movement, material, locationId }, setLocationId);
  }, [keys.hojas]);
  function choose(point: Coordinate) {
    setLatitude(point.latitude.toFixed(6)); setLongitude(point.longitude.toFixed(6));
    setLocationId(undefined); setPicking(false); setOpen(true);
  }
  async function submit() {
    if (writing || blocked) return;
    setMessage('');
    try { await save.run(undefined); setOpen(false); setDescription(''); setLatitude(''); setLongitude(''); setLocationId(undefined); setMessage('Parada agregada. El recorrido se vuelve a calcular.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar la parada.'); if (error instanceof StopWriteError) setBlocked(true); }
  }
  const writable = route.Id_Estado === 3;
  return <View style={{ gap: 12, width: '100%', minWidth: 0 }}>
    {writable && <Action title={picking ? 'Cancelar selección GPS' : 'Parada espontánea'} secondary disabled={writing || blocked} onPress={() => { if (picking) setPicking(false); else { setMessage(''); setOpen(true); } }} />}
    {picking && <Text style={ui.notice}>Tocá el lugar de la nueva parada en el mapa.</Text>}
    {!!message && !open && <Text accessibilityRole="alert" style={ui.notice}>{message}</Text>}
    <CircuitMap routeId={route.Id} origins={origins} busy={writing} canSave={writable} compact onCalculated={setCircuit} onMapPress={picking ? choose : undefined} />
    {writable && <>
      <Action title="Finalizar viaje" disabled={writing || picking || blocked || finishBlocked || (!circuit && trip.data?.phase !== 'odometer-closed') || !trip.data} onPress={() => { setFinishError(''); setFinalValue(String(trip.data?.final ?? Math.ceil((trip.data?.start ?? 0) + (circuit?.distance ?? 0) / 1000))); setFinishing(true); }} />
      {trip.isSuccess && !trip.data && <Text style={ui.error}>No se encontró el odómetro inicial en esta app. Iniciá un viaje nuevo desde Viajes disponibles o consultá al administrador.</Text>}
      {trip.isError && <Text style={ui.error}>No se pudo leer el registro local del odómetro. Consultá al administrador.</Text>}
      {!!finishError && !finishing && <Text accessibilityRole="alert" style={ui.error}>{finishError}</Text>}
    </>}
    {finishing && <BoardModal title="Finalizar viaje" busy={writing} onClose={() => { if (!writing) setFinishing(false); }}>
      <Text style={ui.muted}>Confirmá que terminaste el recorrido y regresaste a EMEC.</Text>
      <Text style={ui.text}>Odómetro inicial: {trip.data?.start} km</Text>
      <Text style={ui.muted}>Recorrido estimado: {Math.ceil((circuit?.distance ?? 0) / 1000)} km (redondeado hacia arriba). Verificá el valor real del tablero.</Text>
      <TextInput accessibilityLabel="Odómetro final" keyboardType="decimal-pad" value={finalValue} onChangeText={setFinalValue} editable={!writing && !finishBlocked && trip.data?.phase !== 'odometer-closed'} style={ui.input} />
      {!!finishError && <Text accessibilityRole="alert" style={ui.error}>{finishError}</Text>}
      <Action title={writing ? 'Finalizando…' : 'Confirmar fin de viaje'} onPress={() => { void confirmFinish(); }} disabled={writing || finishBlocked || !finalValue.trim() || (!circuit && trip.data?.phase !== 'odometer-closed')} />
    </BoardModal>}
    {open && <BoardModal title="Parada espontánea" busy={writing} onClose={() => { if (!writing) setOpen(false); }}>
      <Text style={ui.muted}>Se agregará a tu viaje actual. El circuito se recalculará con este punto.</Text>
      <TextInput accessibilityLabel="Referencia de la parada" placeholder="Referencia del lugar" value={description} onChangeText={setDescription} editable={!writing && !locationId} style={ui.input} />
      <Action title="Marcar punto en el mapa" secondary disabled={writing || !!locationId} onPress={() => { setOpen(false); setPicking(true); }} />
      <View style={ui.row}>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={ui.text}>Latitud</Text><TextInput accessibilityLabel="Latitud" keyboardType="numbers-and-punctuation" value={latitude} onChangeText={setLatitude} editable={!writing && !locationId} style={ui.input} /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={ui.text}>Longitud</Text><TextInput accessibilityLabel="Longitud" keyboardType="numbers-and-punctuation" value={longitude} onChangeText={setLongitude} editable={!writing && !locationId} style={ui.input} /></View>
      </View>
      <SelectField label="Movimiento" value={movement} disabled={writing} options={(movements.data ?? []).map((item) => ({ id: Number(item.IdTipoMovimientos), text: String(item.TipoMovimientos) }))} onChange={setMovement} />
      <SelectField label="Material (opcional)" value={material} disabled={writing} options={[{ id: 0, text: 'General' }, ...(materials.data ?? []).map((item) => ({ id: Number(item.IdTipoMaterial), text: String(item.TipoMaterial) }))]} onChange={setMaterial} />
      {(movements.isError || materials.isError) && <Text style={ui.error}>No se pudieron cargar los catálogos. Cerrá y volvé a abrir el formulario.</Text>}
      {!!message && <Text accessibilityRole="alert" style={ui.error}>{message}</Text>}
      <Action title={writing ? 'Guardando…' : 'Guardar parada'} onPress={() => { void submit(); }} disabled={writing || blocked || !movements.isSuccess || !materials.isSuccess || !movement || !description.trim() || !latitude.trim() || !longitude.trim()} />
    </BoardModal>}
  </View>;
}
