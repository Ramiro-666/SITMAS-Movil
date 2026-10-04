import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Text, TextInput } from './AppText';
import SelectField from './SelectField';
import { Action, BoardModal, ui } from './route-board/BoardUI';
import { TransferProvider, TaskDrag, DropTarget } from './route-board/Transfer';
import CircuitMap from './route-board/CircuitMap';
import { keys, queries, useSitmasQuery, useSitmasMutation } from '../query/sitmas';
import { sitmasApi, type Parada, type HojaRuta, type CatalogItem } from '../services/sitmas-api';
import { assignPendingTask, deleteTask } from '../services/assign-task';
import { currentTaskCoordinates } from '../services/optimized-circuit';
import { validCoordinates } from './maps/types';
import { useRouteBoardStore } from '../state/route-board-store';

const emptyTask = { Id_TipoMovimiento: 0, Id_RecursoMov: 0, Id_Origen: 0, Id_TipoMaterial: 0 };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const options = (items: CatalogItem[], id: string, label: string) => items.map((item) => ({ id: Number(item[id]), text: String(item[label] ?? '') }));
const writable = (route: HojaRuta) => !route.Id_Estado || route.Id_Estado === 1 || route.Id_Estado === 2;
function TaskCard({ task, pending = false, disabled, onAssign, onDelete }: { task: Parada; pending?: boolean; disabled: boolean; onAssign?: () => void; onDelete: () => void }) {
  const content = <View style={styles.task}>
    <View style={ui.row}><Text style={styles.taskTitle}>{task.Origen || `Tarea #${task.Id_Detalle_HDR}`}</Text><Text style={styles.tag}>{task.TipoMovimiento || 'Tarea'}</Text></View>
    <Text style={ui.muted}>#{task.Id_Detalle_HDR} · {task.TipoMaterial || 'General'}{task.RecursoMovilizado ? ` · ${task.RecursoMovilizado}` : ''}</Text>
    {!validCoordinates(task) && <Text style={styles.warning}>Sin coordenadas · ubicación pendiente en SITMAS</Text>}
    <View style={styles.taskFooter}>
      <Text style={styles.dragHint}>⠿ Arrastrar</Text>
      <View style={styles.taskActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${pending ? 'Asignar' : 'Mover'} tarea #${task.Id_Detalle_HDR}`} disabled={disabled} onPress={onAssign} style={[styles.taskAction, disabled && styles.disabledAction]}><Text style={styles.moveText}>{pending ? 'Asignar' : 'Mover'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar tarea #${task.Id_Detalle_HDR}`} disabled={disabled} onPress={onDelete} style={[styles.taskAction, styles.deleteAction, disabled && styles.disabledAction]}><Text style={styles.deleteText}>Eliminar</Text></Pressable>
      </View>
    </View>
  </View>;
  return <TaskDrag taskId={task.Id_Detalle_HDR} disabled={disabled}>{content}</TaskDrag>;
}
function RouteCard({ route, origins, busy, onAssign, onMap, onSelect, onDelete }: { route: HojaRuta; origins: CatalogItem[]; busy: boolean; onAssign: (taskId: number, routeId: number) => void; onMap: () => void; onSelect: (task: Parada) => void; onDelete: (task: Parada) => void }) {
  const detail = useSitmasQuery(queries.paradas(route.Id));
  const tasks = currentTaskCoordinates(detail.data ?? [], origins);
  return <DropTarget routeId={route.Id} disabled={busy || !writable(route)} onDrop={(id) => onAssign(id, route.Id)}>
    <View style={styles.route}>
      <View style={styles.routeHeader}>
        <View style={ui.row}><Text style={styles.routeTitle}>HR #{route.Id}</Text><Text style={styles.plate}>{route.Vehiculo || 'Sin vehículo'}</Text></View>
        <View style={ui.row}><Text style={[ui.muted, styles.routeHeaderText]}>{route.FechaFormateada}</Text><Action title={`Ver en mapa · HR ${route.Id}`} secondary onPress={onMap} disabled={busy} /></View>
      </View>
      <View style={styles.routeBody}>
        <View style={ui.row}><Text style={[styles.tag, route.Estado === 'Asignado' && styles.assigned]}>{route.Estado || 'Pendiente'}</Text><Text style={ui.muted}>Total registrado: {(route.Distancia_Total_Estimada_Km ?? 0).toFixed(2)} km</Text></View>
        {!!route.ChoferNombreCompleto?.trim() && <Text style={ui.muted}>{route.ChoferNombreCompleto}</Text>}
        {detail.isPending && <Text style={ui.muted}>Cargando tareas…</Text>}
        {detail.isError && <Action title={`Reintentar tareas HR ${route.Id}`} secondary onPress={() => { void detail.refetch(); }} />}
        {tasks.map((task) => <TaskCard key={task.Id_Detalle_HDR} task={task} disabled={busy || !writable(route)} onAssign={() => onSelect(task)} onDelete={() => onDelete(task)} />)}
        {!tasks.length && detail.isSuccess && <View style={styles.emptyDrop}><Text style={styles.emptyIcon}>＋</Text><Text style={ui.muted}>{writable(route) ? 'Soltá una tarea aquí' : 'Sin tareas asignadas'}</Text></View>}
        {!!tasks.length && writable(route) && <Text style={ui.muted}>Soltá aquí otra tarea · {tasks.length} asignada(s)</Text>}
      </View>
    </View>
  </DropTarget>;
}
export default function RoutePlanner({ header, footer }: { header: React.ReactElement; footer: React.ReactElement }) {
  const client = useQueryClient();
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  // TanStack mantiene datos remotos y caché; no duplicarlos en useState/Zustand.
  const routesQuery = useSitmasQuery(queries.hojas);
  const pendingQuery = useSitmasQuery(queries.pendientes);
  const originsQuery = useSitmasQuery(queries.origenes);
  const vehiclesQuery = useSitmasQuery(queries.vehiculos);
  const movementsQuery = useSitmasQuery(queries.movimientos);
  const resourcesQuery = useSitmasQuery(queries.recursos);
  const materialsQuery = useSitmasQuery(queries.materiales);
  const statesQuery = useSitmasQuery(queries.estados);
  const routes = [...(routesQuery.data ?? [])].sort((a, b) => b.Id - a.Id);
  const origins = originsQuery.data ?? [];
  const pending = currentTaskCoordinates(pendingQuery.data ?? [], origins);
  // Zustand comparte solo selección y arrastre entre tarjetas, mapa y tablero.
  const board = useRouteBoardStore();
  useEffect(() => () => useRouteBoardStore.getState().reset(), []);
  const [form, setForm] = useState<'task' | 'route' | null>(null);
  const [draft, setDraft] = useState(emptyTask);
  const [routeDraft, setRouteDraft] = useState({ date: today(), vehicle: 0 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<Parada | null>(null);
  const inFlight = useRef(false);
  // Al modificar tareas, TanStack relee pendientes y todas las hojas afectadas.
  const mutation = useSitmasMutation(async (action: () => Promise<unknown>) => action(), [keys.pendientes, keys.hojas]);
  const busy = mutation.isPending;
  const stateId = (name: string) => Number(statesQuery.data?.find((s) => String(s.EstadoHojaRuta).toLowerCase() === name.toLowerCase())?.Id || 0);
  const statuses = [routesQuery, pendingQuery, originsQuery, vehiclesQuery, movementsQuery, resourcesQuery, materialsQuery, statesQuery];
  const refreshing = statuses.some((q) => q.isFetching);
  async function refresh() {
    setError(''); setNotice('');
    await Promise.all([client.invalidateQueries({ queryKey: keys.hojas }), ...statuses.map((q) => q.refetch())]);
  }
  async function perform(action: () => Promise<unknown>, done: (value: unknown) => void) {
    if (inFlight.current) return;
    inFlight.current = true; setError(''); setNotice('');
    try { const result = await mutation.run(action); done(result); }
    catch (e) { setError(e instanceof Error && !('status' in e) ? e.message : 'SITMAS no pudo confirmar el cambio. Actualizamos el tablero; revisalo antes de reintentar.'); }
    finally { inFlight.current = false; }
  }
  function assign(taskId: number, routeId: number) {
    const assignedState = stateId('Asignado');
    if (!assignedState) { setError('No se pudo identificar el estado Asignado. Actualizá los datos.'); return; }
    const task = pending.find((t) => t.Id_Detalle_HDR === taskId) ?? routes.flatMap((r) => client.getQueryData<Parada[]>(keys.paradas(r.Id)) ?? []).find((t) => t.Id_Detalle_HDR === taskId);
    if (!task) { setError('La tarea ya no está disponible. Actualizá el tablero.'); return; }
    void perform(() => assignPendingTask(taskId, routeId, assignedState, origins, task.Id_HojaRuta || null), (message) => { board.selectTask(null); setNotice(String(message)); });
  }
  function createTask() {
    if (!draft.Id_TipoMovimiento || !draft.Id_Origen) { setError('Seleccioná el movimiento y el origen de la tarea.'); return; }
    const state = stateId('Pendiente');
    if (!state) { setError('No se pudo identificar el estado Pendiente.'); return; }
    void perform(() => sitmasApi.crearParada({ ...draft, Id_HojaRuta: null, Id_Estado: state, HoraEstimada: '00:00:00', DistanciaDesdeAnterior_Km: 0 }), () => { setForm(null); setDraft(emptyTask); setNotice('Tarea creada en la lista de pendientes.'); });
  }
  function createRoute() {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(routeDraft.date) && !Number.isNaN(Date.parse(routeDraft.date)) && new Date(routeDraft.date).toISOString().slice(0, 10) === routeDraft.date;
    if (!valid || !routeDraft.vehicle) { setError('Ingresá una fecha válida y seleccioná el vehículo.'); return; }
    const state = stateId('Pendiente');
    if (!state) { setError('No se pudo identificar el estado Pendiente.'); return; }
    void perform(() => sitmasApi.crearHojaRuta({ HojaRutaFecha: routeDraft.date, Id_Vehiculo: routeDraft.vehicle, Id_Chofer: null, Id_Estado: state }), () => { setForm(null); setRouteDraft({ date: today(), vehicle: 0 }); setNotice('Cabecera creada. Ya podés asignarle tareas.'); });
  }
  const chosenOrigin = origins.find((o) => Number(o.IdOrigen) === draft.Id_Origen);
  const selectedMap = routes.find((r) => r.Id === board.mapId);
  const selectedTask = [...pending, ...routes.flatMap((r) => client.getQueryData<Parada[]>(keys.paradas(r.Id)) ?? [])].find((t) => t.Id_Detalle_HDR === board.assignmentId);
  return <TransferProvider>
    <ScrollView nativeID="route-board-scroll" style={{ flex: 1 }} scrollEnabled={board.draggingId === null} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      {header}
      <View style={styles.hero}>
        <View style={{ gap: 5 }}><Text style={styles.eyebrow}>LOGÍSTICA · SITMAS</Text><Text accessibilityRole="header" style={styles.heading}>Hojas de ruta</Text><Text style={ui.muted}>Creá tareas, asignalas a un vehículo y consultá su recorrido.</Text></View>
        <View style={ui.row}><Action title="Nueva cabecera" secondary disabled={busy} onPress={() => { setError(''); setForm('route'); }} /><Action title="Nueva tarea" disabled={busy} onPress={() => { setError(''); setForm('task'); }} /></View>
      </View>
      <View style={ui.row}><Text style={ui.muted}>{routes.length} hojas · {pending.length} tareas pendientes</Text><Action title={refreshing ? 'Actualizando…' : 'Actualizar datos'} secondary disabled={busy || refreshing} onPress={() => { void refresh(); }} /></View>
      {statuses.some((q) => q.isError) && <Text accessibilityRole="alert" style={ui.error}>No se pudieron actualizar todos los datos de SITMAS. Usá «Actualizar datos» para reintentar.</Text>}
      {busy && <Text accessibilityLiveRegion="polite" style={ui.notice}>Guardando en SITMAS y actualizando el recorrido…</Text>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={ui.notice}>{notice}</Text>}
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      <View style={[styles.board, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={[styles.pendingPanel, wide ? { width: 310 } : { width: '100%' }]}>
          <View style={styles.pendingHeader}><Text style={styles.panelTitle}>Lista de pendientes</Text><Text style={styles.count}>{pending.length}</Text></View>
          <View style={{ padding: 12, gap: 10 }}>
            {pendingQuery.isPending && <Text style={ui.muted}>Cargando tareas…</Text>}
            {pendingQuery.isSuccess && !pending.length && <View style={styles.emptyDrop}><Text style={styles.emptyIcon}>✓</Text><Text style={styles.taskTitle}>Todo asignado</Text><Text style={ui.muted}>Las nuevas tareas aparecerán aquí.</Text></View>}
            {pending.map((task) => <TaskCard key={task.Id_Detalle_HDR} task={task} pending disabled={busy} onDelete={() => { setError(''); setDeleting(task); }} onAssign={() => { setError(''); board.selectTask(task.Id_Detalle_HDR); }} />)}
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
          <View style={styles.workHeader}><Text style={styles.workTitle}>Hojas de ruta en trabajo</Text><Text style={styles.workHint}>Asigná pendientes o trasladá tareas entre hojas</Text></View>
          {routesQuery.isPending && <Text style={ui.muted}>Cargando hojas…</Text>}
          {routesQuery.isSuccess && !routes.length && <Text style={ui.notice}>Creá una cabecera para empezar a organizar las tareas.</Text>}
          <View style={styles.grid}>{routes.map((route) => <View key={route.Id} style={{ width: width >= 1280 ? '48.8%' : '100%' }}><RouteCard route={route} origins={origins} busy={busy} onAssign={assign} onSelect={(task) => { setError(''); board.selectTask(task.Id_Detalle_HDR); }} onDelete={(task) => { setError(''); setDeleting(task); }} onMap={() => { setError(''); setNotice(''); board.openMap(route.Id); }} /></View>)}</View>
        </View>
      </View>
      {footer}
    </ScrollView>
    {form && <BoardModal title={form === 'task' ? 'Nueva tarea pendiente' : 'Nueva cabecera'} busy={busy} onClose={() => { setForm(null); setError(''); }}>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      {form === 'task' ? <>
        <Text style={ui.muted}>Se guardará en pendientes. Después podés asignarla a una hoja de ruta.</Text>
        <SelectField label="Tipo de movimiento" value={draft.Id_TipoMovimiento} disabled={busy} options={options(movementsQuery.data ?? [], 'IdTipoMovimientos', 'TipoMovimientos')} onChange={(v) => setDraft((d) => ({ ...d, Id_TipoMovimiento: v }))} />
        <SelectField label="Origen de la tarea" value={draft.Id_Origen} disabled={busy} options={origins.map((o) => ({ id: Number(o.IdOrigen), text: `${o.EmpresaInstitucion} · #${o.IdOrigen}${typeof o.Latitud !== 'number' || typeof o.Longitud !== 'number' ? ' · Sin GPS' : ''}` }))} onChange={(v) => setDraft((d) => ({ ...d, Id_Origen: v }))} />
        {chosenOrigin && (typeof chosenOrigin.Latitud !== 'number' || typeof chosenOrigin.Longitud !== 'number') && <Text style={styles.warning}>Este origen no tiene coordenadas. La tarea se puede asignar, pero el circuito quedará incompleto hasta que se actualice en SITMAS.</Text>}
        <SelectField label="Recurso movilizado (opcional)" value={draft.Id_RecursoMov} disabled={busy} options={[{ id: 0, text: 'Sin especificar' }, ...options(resourcesQuery.data ?? [], 'IdRecursoMov', 'Recurso_Movilizado')]} onChange={(v) => setDraft((d) => ({ ...d, Id_RecursoMov: v }))} />
        <SelectField label="Material (opcional)" value={draft.Id_TipoMaterial} disabled={busy} options={[{ id: 0, text: 'General' }, ...options(materialsQuery.data ?? [], 'IdTipoMaterial', 'TipoMaterial')]} onChange={(v) => setDraft((d) => ({ ...d, Id_TipoMaterial: v }))} />
        <Action title="Crear tarea pendiente" onPress={createTask} disabled={busy || statesQuery.isPending} />
      </> : <>
        <Text style={ui.muted}>Indicá la fecha y el vehículo. No es necesario asignar un chofer para crear la cabecera.</Text>
        <Text style={ui.text}>Fecha · AAAA-MM-DD</Text><TextInput accessibilityLabel="Fecha de la cabecera" editable={!busy} style={ui.input} value={routeDraft.date} onChangeText={(date) => setRouteDraft((d) => ({ ...d, date }))} placeholder="AAAA-MM-DD" />
        <SelectField label="Vehículo" value={routeDraft.vehicle} disabled={busy} options={(vehiclesQuery.data ?? []).map((v) => ({ id: v.Id, text: v.Patente }))} onChange={(vehicle) => setRouteDraft((d) => ({ ...d, vehicle }))} />
        <Action title="Crear cabecera" onPress={createRoute} disabled={busy || statesQuery.isPending} />
      </>}
    </BoardModal>}
    {board.assignmentId !== null && <BoardModal title={`Asignar tarea #${board.assignmentId}`} busy={busy} onClose={() => board.selectTask(null)}>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      <Text style={ui.text}>{selectedTask?.Origen || 'La tarea ya no está disponible.'}</Text>
      {routes.filter((r) => writable(r) && r.Id !== selectedTask?.Id_HojaRuta).map((route) => <Action key={route.Id} title={`Asignar a HR ${route.Id} · ${route.FechaFormateada} · ${route.Vehiculo}`} disabled={busy || !selectedTask} secondary onPress={() => assign(board.assignmentId!, route.Id)} />)}
      {!routes.some(writable) && <Text style={ui.muted}>Primero creá una cabecera disponible.</Text>}
    </BoardModal>}
    {deleting && <BoardModal title={`Eliminar tarea #${deleting.Id_Detalle_HDR}`} busy={busy} onClose={() => setDeleting(null)}>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      <Text style={ui.text}>Se eliminará la tarea de {deleting.Origen || 'este origen'}{deleting.Id_HojaRuta ? ` de la hoja HR ${deleting.Id_HojaRuta}` : ' de pendientes'}. Esta acción no se puede deshacer.</Text>
      <Action title="Confirmar eliminación" disabled={busy} onPress={() => { void perform(() => deleteTask(deleting.Id_Detalle_HDR, deleting.Id_HojaRuta || null, origins), (message) => { setDeleting(null); setNotice(String(message)); }); }} />
    </BoardModal>}
    {selectedMap && <BoardModal title={`Recorrido · HR ${selectedMap.Id} · ${selectedMap.FechaFormateada}`} busy={busy} onClose={() => board.openMap(null)}>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      {!!notice && <Text style={ui.notice}>{notice}</Text>}
      <CircuitMap routeId={selectedMap.Id} origins={origins} pending={pending} busy={busy} canAssign={writable(selectedMap)} onAssign={assign} />
    </BoardModal>}
  </TransferProvider>;
}
const styles = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingBottom: 30, gap: 14 },
  hero: { paddingVertical: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6, color: '#4d8069' },
  heading: { fontSize: 28, fontWeight: '800', color: '#164d3b' },
  board: { gap: 18, alignItems: 'flex-start' },
  pendingPanel: { backgroundColor: '#fffdf5', borderWidth: 1, borderColor: '#e7d691', borderRadius: 14 },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f6ce52', padding: 16, borderTopLeftRadius: 13, borderTopRightRadius: 13 },
  panelTitle: { fontSize: 15, fontWeight: '800', color: '#524015' },
  count: { backgroundColor: '#584719', color: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontWeight: '800' },
  workHeader: { backgroundColor: '#203f33', padding: 16, borderRadius: 12, gap: 4 },
  workTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  workHint: { fontSize: 11, color: '#c5d9cd' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' },
  route: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cfddd4', borderRadius: 14 },
  routeHeader: { backgroundColor: '#087947', padding: 10, gap: 6, borderTopLeftRadius: 13, borderTopRightRadius: 13 },
  routeTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  routeHeaderText: { color: '#fff' },
  plate: { color: '#3c554a', fontSize: 12, fontWeight: '800', backgroundColor: '#fff', borderRadius: 5, padding: 5 },
  routeBody: { padding: 10, gap: 8 },
  task: { backgroundColor: '#fff', borderWidth: 1, borderLeftWidth: 4, borderColor: '#d8e3db', borderLeftColor: '#3f87cc', borderRadius: 9, padding: 10, gap: 6 },
  taskFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  taskActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  taskAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#edf5ef' },
  deleteAction: { backgroundColor: '#fff0ec' },
  disabledAction: { opacity: 0.45 },
  moveText: { fontSize: 12, fontWeight: '700', color: '#176346' },
  deleteText: { fontSize: 12, fontWeight: '700', color: '#a33321' },
  dragHint: { fontSize: 11, color: '#64766e', flexShrink: 1 },
  taskTitle: { color: '#244c3a', fontSize: 13, fontWeight: '800', flexShrink: 1 },
  tag: { fontSize: 10, fontWeight: '800', color: '#775b0c', backgroundColor: '#fff1bf', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  assigned: { backgroundColor: '#e2eefc', color: '#245e9c' },
  warning: { color: '#8c621c', backgroundColor: '#fff4d9', padding: 8, borderRadius: 6, fontSize: 11, lineHeight: 17 },
  emptyDrop: { padding: 16, alignItems: 'center', gap: 8, backgroundColor: '#f8faf7', borderWidth: 1, borderStyle: 'dashed', borderColor: '#c4d6c9', borderRadius: 9 },
  emptyIcon: { fontSize: 25, color: '#8aa797' },
});
