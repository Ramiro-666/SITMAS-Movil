import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CatalogItem, Chofer, HojaRuta, Parada, sitmasApi, Vehiculo } from '../services/sitmas-api';

const START = 6 * 60;
const END = 22 * 60;
const SLOT_HEIGHT = 40;
const minutes = (value?: string) => {
  const found = /^(\d{1,2}):(\d{2})/.exec(value || '');
  return found ? Number(found[1]) * 60 + Number(found[2]) : START;
};
const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}:00`;
const dateISO = (route?: HojaRuta | null) => {
  if (route?.HojaRutaFecha && !route.HojaRutaFecha.startsWith('0001')) return route.HojaRutaFecha.slice(0, 10);
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(route?.FechaFormateada || '');
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
};
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const validTime = (value: string) => {
  const found = /^(\d{2}):(\d{2})$/.exec(value);
  return !!found && Number(found[1]) < 24 && Number(found[2]) < 60;
};
const idOf = (item: CatalogItem, key: string) => Number(item[key] ?? item.Id ?? 0);
const labelOf = (item: CatalogItem, key: string) => String(item[key] ?? 'Sin descripción');

function SelectField({ label, value, options, onChange }: { label: string; value: number; options: { id: number; text: string }[]; onChange: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.fieldGroup}>
    <Text style={styles.label}>{label}</Text>
    <Pressable style={styles.select} onPress={() => setOpen(!open)}>
      <Text style={styles.selectText}>{options.find(x => x.id === value)?.text || `Seleccionar ${label.toLowerCase()}`}</Text>
      <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>
    {open && <View style={styles.options}>{options.map(x => <Pressable key={x.id} onPress={() => { onChange(x.id); setOpen(false); }} style={styles.option}><Text style={styles.selectText}>{x.text}</Text></Pressable>)}</View>}
  </View>;
}

function StopBlock({ stop, onDrop, onOpen }: { stop: Parada; onDrop: (stop: Parada, deltaY: number) => void; onOpen: (stop: Parada) => void }) {
  const offset = useRef(new Animated.Value(0)).current;
  const start = Math.max(START, Math.min(END - 30, minutes(stop.HoraEstimadaFormateada || stop.HoraEstimada)));
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 7,
    onPanResponderMove: (_, g) => offset.setValue(g.dy),
    onPanResponderRelease: (_, g) => { offset.setValue(0); if (Math.abs(g.dy) > 15) onDrop(stop, g.dy); },
    onPanResponderTerminate: () => offset.setValue(0),
  }), [offset, onDrop, stop]);
  return <Animated.View {...pan.panHandlers} style={[styles.stop, { top: ((start - START) / 30) * SLOT_HEIGHT, transform: [{ translateY: offset }] }]}>
    <Pressable onPress={() => onOpen(stop)}>
      <Text style={styles.stopTime}>{time(start).slice(0, 5)} · {stop.EstadoRecorrido || 'Pendiente'}</Text>
      <Text style={styles.stopName}>{stop.Origen || 'Origen sin descripción'}</Text>
      <Text style={styles.stopDetail}>{stop.TipoMovimiento || 'Movimiento'} · {stop.TipoMaterial || 'Material'}</Text>
      <Text style={styles.dragHint}>↕ Arrastrar para cambiar la hora · Tocar para editar</Text>
    </Pressable>
  </Animated.View>;
}

type StopDraft = Pick<Parada, 'Id_TipoMovimiento' | 'Id_RecursoMov' | 'Id_Origen' | 'Id_TipoMaterial' | 'Id_Estado' | 'HoraEstimada'>;
const emptyStop: StopDraft = { Id_TipoMovimiento: 0, Id_RecursoMov: 0, Id_Origen: 0, Id_TipoMaterial: 0, Id_Estado: 0, HoraEstimada: '08:00:00' };

export default function RoutePlanner() {
  const [routes, setRoutes] = useState<HojaRuta[]>([]);
  const [vehicles, setVehicles] = useState<Vehiculo[]>([]);
  const [drivers, setDrivers] = useState<Chofer[]>([]);
  const [catalogs, setCatalogs] = useState<{ movement: CatalogItem[]; resource: CatalogItem[]; origin: CatalogItem[]; material: CatalogItem[]; state: CatalogItem[] }>({ movement: [], resource: [], origin: [], material: [], state: [] });
  const [selected, setSelected] = useState<HojaRuta | null>(null);
  const [stops, setStops] = useState<Parada[]>([]);
  const [listOpen, setListOpen] = useState(true);
  const [routeFormOpen, setRouteFormOpen] = useState(false);
  const [routeDraft, setRouteDraft] = useState({ date: '', vehicle: 0, driver: 0 });
  const [editingRoute, setEditingRoute] = useState<number | null>(null);
  const [stopFormOpen, setStopFormOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Parada | null>(null);
  const [stopDraft, setStopDraft] = useState<StopDraft>(emptyStop);
  const [moveStop, setMoveStop] = useState<Parada | null>(null);
  const [moveDate, setMoveDate] = useState('');
  const [moveTime, setMoveTime] = useState('');
  const [keepResources, setKeepResources] = useState(true);
  const [moveVehicle, setMoveVehicle] = useState(0);
  const [moveDriver, setMoveDriver] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadRoutes = useCallback(async () => {
    try { setRoutes(await sitmasApi.hojasRuta()); } catch { setError('No se pudieron cargar las hojas de ruta.'); }
  }, []);
  const loadStops = useCallback(async (id: number) => {
    try { setStops(await sitmasApi.detalleHojaRuta(id)); } catch { setError('No se pudieron cargar las paradas.'); }
  }, []);
  useEffect(() => {
    Promise.allSettled([sitmasApi.hojasRuta(), sitmasApi.vehiculos(), sitmasApi.choferes(), sitmasApi.tiposMovimiento(), sitmasApi.recursosMovilizados(), sitmasApi.origenes(), sitmasApi.materiales(), sitmasApi.estadosHojaRuta()])
      .then(results => {
        const [r,v,d,m,re,o,ma,e] = results;
        if (r.status === 'fulfilled') setRoutes(r.value); else setError('No se pudieron cargar las hojas de ruta.');
        if (v.status === 'fulfilled') setVehicles(v.value);
        if (d.status === 'fulfilled') setDrivers(d.value);
        setCatalogs({ movement: m.status === 'fulfilled' ? m.value : [], resource: re.status === 'fulfilled' ? re.value : [], origin: o.status === 'fulfilled' ? o.value : [], material: ma.status === 'fulfilled' ? ma.value : [], state: e.status === 'fulfilled' ? e.value : [] });
      });
  }, []);

  async function choose(route: HojaRuta) {
    setError('');
    try {
      const [full, details] = await Promise.all([sitmasApi.hojaRuta(route.Id), sitmasApi.detalleHojaRuta(route.Id)]);
      setSelected({ ...route, ...full, FechaFormateada: route.FechaFormateada || full.FechaFormateada, Vehiculo: route.Vehiculo || full.Vehiculo, ChoferNombreCompleto: route.ChoferNombreCompleto || full.ChoferNombreCompleto });
      setStops(details);
      setListOpen(false);
      setStopFormOpen(false);
    } catch { setError('No se pudo abrir esta hoja de ruta.'); }
  }
  function editRoute() {
    if (!selected) return;
    setEditingRoute(selected.Id);
    setRouteDraft({ date: dateISO(selected), vehicle: selected.Id_Vehiculo || 0, driver: selected.Id_Chofer || 0 });
    setRouteFormOpen(true);
  }
  async function saveRoute() {
    if (!validDate(routeDraft.date) || !routeDraft.vehicle || !routeDraft.driver) return Alert.alert('Datos incompletos', 'Seleccioná una fecha válida, vehículo y chofer.');
    setBusy(true);
    try {
      const payload = { HojaRutaFecha: routeDraft.date, Id_Vehiculo: routeDraft.vehicle, Id_Chofer: routeDraft.driver };
      if (editingRoute) { await sitmasApi.actualizarHojaRuta(editingRoute, payload); await choose({ ...selected!, Id: editingRoute }); }
      else await sitmasApi.crearHojaRuta(payload);
      await loadRoutes(); setRouteFormOpen(false); setEditingRoute(null); setRouteDraft({ date: '', vehicle: 0, driver: 0 });
    } catch { Alert.alert('No se pudo guardar', 'Revisá los datos y la conexión con SITMAS.'); }
    finally { setBusy(false); }
  }
  function askDeleteRoute() {
    if (!selected) return;
    Alert.alert('Eliminar hoja de ruta', 'Se borrarán también sus paradas. ¿Continuar?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => {
      try { await sitmasApi.borrarHojaRuta(selected.Id); setSelected(null); setStops([]); setListOpen(true); await loadRoutes(); }
      catch { Alert.alert('No se pudo eliminar', 'La API rechazó la operación.'); }
    } }]);
  }
  function editStop(stop?: Parada) {
    setEditingStop(stop || null);
    setStopDraft(stop ? { Id_TipoMovimiento: stop.Id_TipoMovimiento, Id_RecursoMov: stop.Id_RecursoMov, Id_Origen: stop.Id_Origen, Id_TipoMaterial: stop.Id_TipoMaterial, Id_Estado: stop.Id_Estado, HoraEstimada: stop.HoraEstimadaFormateada || stop.HoraEstimada || '08:00:00' } : emptyStop);
    setStopFormOpen(true);
  }
  async function saveStop() {
    if (!selected || !stopDraft.Id_TipoMovimiento || !stopDraft.Id_RecursoMov || !stopDraft.Id_Origen || !stopDraft.Id_TipoMaterial || !stopDraft.Id_Estado || !/^\d{2}:\d{2}/.test(stopDraft.HoraEstimada || '')) return Alert.alert('Datos incompletos', 'Completá todos los campos de la parada y la hora.');
    setBusy(true);
    try {
      const payload = { ...stopDraft, HoraEstimada: time(minutes(stopDraft.HoraEstimada)), Id_HojaRuta: selected.Id };
      if (editingStop) await sitmasApi.actualizarParada({ ...editingStop, ...payload });
      else await sitmasApi.crearParada(payload);
      await loadStops(selected.Id); setStopFormOpen(false); setEditingStop(null);
    } catch { Alert.alert('No se pudo guardar', 'La API rechazó la parada.'); }
    finally { setBusy(false); }
  }
  function askDeleteStop() {
    if (!editingStop || !selected) return;
    Alert.alert('Eliminar parada', '¿Eliminar esta parada de la hoja de ruta?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => {
      try { await sitmasApi.borrarParada(editingStop.Id_Detalle_HDR); await loadStops(selected.Id); setStopFormOpen(false); }
      catch { Alert.alert('No se pudo eliminar', 'La API rechazó la operación.'); }
    } }]);
  }
  const drop = useCallback(async (stop: Parada, deltaY: number) => {
    if (!selected) return;
    const current = minutes(stop.HoraEstimadaFormateada || stop.HoraEstimada);
    const next = Math.max(START, Math.min(END - 30, Math.round((current + deltaY * 30 / SLOT_HEIGHT) / 30) * 30));
    if (next === current) return;
    setStops(previous => previous.map(item => item.Id_Detalle_HDR === stop.Id_Detalle_HDR ? { ...item, HoraEstimadaFormateada: time(next) } : item));
    try { await sitmasApi.actualizarParada({ ...stop, HoraEstimada: time(next) }); await loadStops(selected.Id); }
    catch { await loadStops(selected.Id); Alert.alert('No se pudo cambiar la hora', 'La API rechazó el nuevo horario.'); }
  }, [loadStops, selected]);
  function openMove(stop: Parada) {
    setMoveStop(stop); setMoveDate(dateISO(selected)); setMoveTime((stop.HoraEstimadaFormateada || stop.HoraEstimada || '08:00').slice(0, 5));
    setKeepResources(true); setMoveVehicle(selected?.Id_Vehiculo || 0); setMoveDriver(selected?.Id_Chofer || 0);
  }
  async function confirmMove() {
    if (!moveStop || !selected || !validDate(moveDate) || !validTime(moveTime)) return Alert.alert('Datos incompletos', 'Ingresá fecha y hora válidas.');
    const currentDate = dateISO(selected);
    if (moveDate === currentDate) {
      try { await sitmasApi.actualizarParada({ ...moveStop, HoraEstimada: time(minutes(moveTime)) }); await loadStops(selected.Id); setMoveStop(null); }
      catch { Alert.alert('No se pudo mover', 'La API rechazó el horario.'); }
      return;
    }
    if (!moveVehicle || !moveDriver) return Alert.alert('Datos incompletos', 'Seleccioná vehículo y chofer.');
    setBusy(true);
    try {
      const candidates = routes.filter(r => dateISO(r) === moveDate);
      const headers = await Promise.all(candidates.map(r => sitmasApi.hojaRuta(r.Id)));
      const existing = headers.find(r => r.Id_Vehiculo === moveVehicle && r.Id_Chofer === moveDriver);
      const destinationId = existing?.Id || (await sitmasApi.crearHojaRuta({ HojaRutaFecha: moveDate, Id_Vehiculo: moveVehicle, Id_Chofer: moveDriver })).IdGenerado;
      if (!destinationId) throw new Error('Sin ID de hoja destino');
      await sitmasApi.actualizarParada({ ...moveStop, Id_HojaRuta: destinationId, HoraEstimada: time(minutes(moveTime)) });
      await Promise.all([loadRoutes(), loadStops(selected.Id)]); setMoveStop(null);
    } catch { Alert.alert('No se pudo trasladar', 'Revisá la hoja destino. Si se creó una hoja nueva, verificá en el listado antes de reintentar.'); }
    finally { setBusy(false); }
  }

  const vehiclesOptions = vehicles.map(v => ({ id: v.Id, text: v.Patente }));
  const driversOptions = drivers.map(d => ({ id: d.Id, text: `${d.Apellido || ''} ${d.Nombre || ''}`.trim() }));
  return <View>
    <View style={styles.topBar}><Text style={styles.title}>HOJAS DE RUTA</Text><Pressable onPress={() => { setEditingRoute(null); setRouteDraft({ date: '', vehicle: 0, driver: 0 }); setRouteFormOpen(!routeFormOpen); }} style={styles.primary}><Text style={styles.primaryText}>+ NUEVA</Text></Pressable></View>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {routeFormOpen && <View style={styles.panel}><Text style={styles.panelTitle}>{editingRoute ? 'Editar hoja de ruta' : 'Nueva hoja de ruta'}</Text><Text style={styles.label}>FECHA · AAAA-MM-DD</Text><TextInput value={routeDraft.date} onChangeText={date => setRouteDraft(d => ({ ...d, date }))} placeholder="2026-09-16" style={styles.input}/><SelectField label="Vehículo" value={routeDraft.vehicle} options={vehiclesOptions} onChange={vehicle => setRouteDraft(d => ({ ...d, vehicle }))}/><SelectField label="Chofer" value={routeDraft.driver} options={driversOptions} onChange={driver => setRouteDraft(d => ({ ...d, driver }))}/><Pressable onPress={saveRoute} disabled={busy} style={styles.primary}><Text style={styles.primaryText}>{editingRoute ? 'GUARDAR CAMBIOS' : 'CREAR HOJA'}</Text></Pressable></View>}
    <View style={styles.panel}><Pressable onPress={() => setListOpen(!listOpen)} style={styles.listHeader}><Text style={styles.panelTitle}>HOJAS DE RUTA EXISTENTES</Text><Text style={styles.chevron}>{listOpen ? '⌃' : '⌄'}</Text></Pressable>{listOpen && routes.map(route => <Pressable key={route.Id} onPress={() => choose(route)} style={styles.routeRow}><Text style={styles.routeId}>HR-{route.Id}</Text><View style={{ flex: 1 }}><Text style={styles.routeMain}>{route.FechaFormateada || dateISO(route)} · {route.Vehiculo}</Text><Text style={styles.small}>{route.ChoferNombreCompleto}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>
    {selected && <View style={styles.panel}><Text style={styles.panelTitle}>HOJA #{selected.Id} · {selected.FechaFormateada}</Text><Text style={styles.small}>{selected.Vehiculo} · {selected.ChoferNombreCompleto}</Text><View style={styles.actions}><Pressable onPress={editRoute} style={styles.outline}><Text style={styles.outlineText}>EDITAR HOJA</Text></Pressable><Pressable onPress={askDeleteRoute} style={styles.outline}><Text style={styles.deleteText}>ELIMINAR</Text></Pressable></View><View style={styles.actions}><Text style={styles.panelTitle}>PARADAS · AGENDA</Text><Pressable onPress={() => editStop()} style={styles.primary}><Text style={styles.primaryText}>+ PARADA</Text></Pressable></View><Text style={styles.small}>Arrastrá una tarjeta para cambiar su horario. Tocala para editarla.</Text><View style={styles.calendar}>{Array.from({ length: 32 }, (_, i) => <View key={i} style={styles.slot}><Text style={styles.slotTime}>{time(START + i * 30).slice(0, 5)}</Text><View style={styles.slotLine}/></View>)}{stops.map(stop => <StopBlock key={stop.Id_Detalle_HDR} stop={stop} onDrop={drop} onOpen={editStop}/>)}</View>{stops.length === 0 && <Text style={styles.small}>Esta hoja todavía no tiene paradas.</Text>}</View>}
    <Modal transparent visible={stopFormOpen && !!selected} onRequestClose={() => setStopFormOpen(false)} animationType="slide"><View style={styles.modalBackdrop}><ScrollView contentContainerStyle={styles.modalContent}><View style={styles.panel}><Text style={styles.panelTitle}>{editingStop ? `EDITAR PARADA #${editingStop.Id_Detalle_HDR}` : 'AGREGAR PARADA'}</Text><SelectField label="Tipo de movimiento" value={stopDraft.Id_TipoMovimiento} options={catalogs.movement.map(x => ({ id: idOf(x, 'IdTipoMovimientos'), text: labelOf(x, 'TipoMovimientos') }))} onChange={v => setStopDraft(d => ({ ...d, Id_TipoMovimiento: v }))}/><SelectField label="Recurso movilizado" value={stopDraft.Id_RecursoMov} options={catalogs.resource.map(x => ({ id: idOf(x, 'IdRecursoMov'), text: labelOf(x, 'Recurso_Movilizado') }))} onChange={v => setStopDraft(d => ({ ...d, Id_RecursoMov: v }))}/><SelectField label="Lugar / origen" value={stopDraft.Id_Origen} options={catalogs.origin.map(x => ({ id: idOf(x, 'IdOrigen'), text: labelOf(x, 'EmpresaInstitucion') }))} onChange={v => setStopDraft(d => ({ ...d, Id_Origen: v }))}/><SelectField label="Tipo material" value={stopDraft.Id_TipoMaterial} options={catalogs.material.map(x => ({ id: idOf(x, 'IdTipoMaterial'), text: labelOf(x, 'TipoMaterial') }))} onChange={v => setStopDraft(d => ({ ...d, Id_TipoMaterial: v }))}/><Text style={styles.label}>HORA ESTIMADA · HH:MM</Text><TextInput value={(stopDraft.HoraEstimada || '').slice(0, 5)} onChangeText={v => setStopDraft(d => ({ ...d, HoraEstimada: v }))} placeholder="08:00" style={styles.input}/><SelectField label="Estado" value={stopDraft.Id_Estado} options={catalogs.state.map(x => ({ id: idOf(x, 'Id'), text: labelOf(x, 'EstadoHojaRuta') }))} onChange={v => setStopDraft(d => ({ ...d, Id_Estado: v }))}/><View style={styles.actions}><Pressable onPress={() => setStopFormOpen(false)} style={styles.outline}><Text style={styles.outlineText}>CANCELAR</Text></Pressable><Pressable onPress={saveStop} disabled={busy} style={styles.primary}><Text style={styles.primaryText}>GUARDAR PARADA</Text></Pressable></View>{editingStop && <View style={styles.actions}><Pressable onPress={() => { setStopFormOpen(false); openMove(editingStop); }} style={styles.outline}><Text style={styles.outlineText}>CAMBIAR DÍA</Text></Pressable><Pressable onPress={askDeleteStop} style={styles.outline}><Text style={styles.deleteText}>ELIMINAR PARADA</Text></Pressable></View>}</View></ScrollView></View></Modal>
    <Modal transparent visible={!!moveStop} onRequestClose={() => setMoveStop(null)} animationType="slide"><View style={styles.modalBackdrop}><ScrollView contentContainerStyle={styles.modalContent}><View style={styles.panel}><Text style={styles.panelTitle}>REPROGRAMAR PARADA #{moveStop?.Id_Detalle_HDR}</Text><Text style={styles.label}>NUEVA FECHA · AAAA-MM-DD</Text><TextInput value={moveDate} onChangeText={setMoveDate} style={styles.input}/><Text style={styles.label}>NUEVA HORA · HH:MM</Text><TextInput value={moveTime} onChangeText={setMoveTime} style={styles.input}/><Text style={styles.question}>¿Desea conservar los datos del vehículo y/o chofer?</Text><View style={styles.actions}><Pressable onPress={() => { setKeepResources(true); setMoveVehicle(selected?.Id_Vehiculo || 0); setMoveDriver(selected?.Id_Chofer || 0); }} style={styles.outline}><Text style={styles.outlineText}>{keepResources ? '✓ ' : ''}CONSERVAR</Text></Pressable><Pressable onPress={() => setKeepResources(false)} style={styles.outline}><Text style={styles.outlineText}>{!keepResources ? '✓ ' : ''}CAMBIAR</Text></Pressable></View>{!keepResources && <><SelectField label="Vehículo nuevo" value={moveVehicle} options={vehiclesOptions} onChange={setMoveVehicle}/><SelectField label="Chofer nuevo" value={moveDriver} options={driversOptions} onChange={setMoveDriver}/></>}<View style={styles.actions}><Pressable onPress={() => setMoveStop(null)} style={styles.outline}><Text style={styles.outlineText}>CANCELAR</Text></Pressable><Pressable onPress={confirmMove} disabled={busy} style={styles.primary}><Text style={styles.primaryText}>CONFIRMAR</Text></Pressable></View></View></ScrollView></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: '#006d38', fontWeight: '800', fontSize: 17 },
  panel: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 2 },
  panelTitle: { color: '#006d38', fontSize: 13, fontWeight: '800', flexShrink: 1 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderColor: '#e5eee8' },
  routeId: { color: '#662d91', fontWeight: '800', fontSize: 11 },
  routeMain: { color: '#1b3d45', fontSize: 12, fontWeight: '700' },
  small: { color: '#6c8390', fontSize: 11, marginTop: 4 },
  label: { color: '#006d38', fontSize: 10, fontWeight: '800', marginTop: 12, marginBottom: 5 },
  fieldGroup: { marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#cbdde1', height: 45, borderRadius: 8, paddingHorizontal: 12, color: '#173542' },
  select: { borderWidth: 1, borderColor: '#cbdde1', minHeight: 45, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { color: '#173542', fontSize: 12, flexShrink: 1 },
  chevron: { color: '#006d38', fontSize: 18, fontWeight: '700' },
  options: { borderWidth: 1, borderColor: '#dce8df', borderRadius: 8, maxHeight: 220, overflow: 'hidden' },
  option: { padding: 11, borderBottomWidth: 1, borderColor: '#e6eee9' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  primary: { backgroundColor: '#007b3e', borderRadius: 7, paddingHorizontal: 12, paddingVertical: 10 },
  primaryText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  outline: { borderWidth: 1, borderColor: '#a7c9bb', borderRadius: 7, paddingHorizontal: 11, paddingVertical: 9 },
  outlineText: { color: '#006d38', fontSize: 10, fontWeight: '800' },
  deleteText: { color: '#b62d31', fontSize: 10, fontWeight: '800' },
  error: { color: '#b62d31', fontSize: 11, marginBottom: 10 },
  calendar: { height: 32 * SLOT_HEIGHT, position: 'relative', marginTop: 14 },
  slot: { height: SLOT_HEIGHT, flexDirection: 'row' },
  slotTime: { color: '#758790', width: 44, fontSize: 10 },
  slotLine: { borderTopWidth: 1, borderColor: '#e4ebe8', flex: 1, marginTop: 6 },
  stop: { position: 'absolute', left: 48, right: 0, minHeight: 62, borderRadius: 8, backgroundColor: '#087947', borderLeftWidth: 5, borderColor: '#73bd28', padding: 7, elevation: 4, zIndex: 1 },
  stopTime: { color: '#c7f1d6', fontWeight: '800', fontSize: 10 },
  stopName: { color: '#fff', fontWeight: '800', fontSize: 12 },
  stopDetail: { color: '#ebfff2', fontSize: 10 },
  dragHint: { color: '#d5eee0', fontSize: 9, marginTop: 4 },
  question: { color: '#1b3d45', fontWeight: '800', fontSize: 12, marginTop: 15 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(12,35,42,.6)' },
  modalContent: { flexGrow: 1, justifyContent: 'center', padding: 18, paddingVertical: 40 },
});
