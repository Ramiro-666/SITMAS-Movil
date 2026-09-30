import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../AppText';
import { Action, ui } from './BoardUI';
import RouteCanvas from '../maps/RouteCanvas';
import SelectField from '../SelectField';
import { validCoordinates } from '../maps/types';
import { queries, useSitmasQuery, useSitmasMutation, keys } from '../../query/sitmas';
import { currentTaskCoordinates, findBase, optimizeCircuit } from '../../services/optimized-circuit';
import { routingEndpoint, type RouteStop } from '../../services/route-geometry';
import { sitmasApi, type CatalogItem, type Parada } from '../../services/sitmas-api';

export default function CircuitMap({ routeId, origins, pending, busy, canAssign, onAssign }: {
  routeId: number; origins: CatalogItem[]; pending: Parada[]; busy: boolean; canAssign: boolean; onAssign: (taskId: number, routeId: number) => void;
}) {
  const client = useQueryClient();
  const detail = useSitmasQuery(queries.paradas(routeId));
  const tasks = useMemo(() => currentTaskCoordinates(detail.data ?? [], origins), [detail.data, origins]);
  const base = useMemo(() => findBase(origins), [origins]);
  const [selected, setSelected] = useState<number | null>(null);
  const [fit, setFit] = useState(0);
  const [message, setMessage] = useState('');
  const route = useQuery({
    queryKey: ['optimizedRoute', routeId, routingEndpoint, base, tasks.map((t) => [t.Id_Detalle_HDR, t.Latitud, t.Longitud])],
    queryFn: ({ signal }) => optimizeCircuit(tasks, base!, signal),
    enabled: detail.isSuccess && !!base,
    staleTime: 60000, retry: false,
  });
  const ordered = useMemo(() => route.isSuccess ? route.data.tasks.map((t) => tasks.find((fresh) => fresh.Id_Detalle_HDR === t.Id_Detalle_HDR)!).filter(Boolean) : tasks, [route.data, route.isSuccess, tasks]);
  const points = useMemo(() => {
    const list: RouteStop[] = ordered.map((stop, index) => ({ stop, number: index + 1, coordinate: validCoordinates(stop) ? { latitude: stop.Latitud!, longitude: stop.Longitud! } : null }));
    // Marcador de la sede real: no representa una tarea ni se envía a la API.
    if (base) list.unshift({ number: 0, coordinate: base, stop: { Id_Detalle_HDR: -1, Id_HojaRuta: routeId, Id_Origen: 0, Id_TipoMovimiento: 0, Id_RecursoMov: 0, Id_TipoMaterial: 0, Id_Estado: 0, Origen: 'Sede EMEC · salida y regreso' } });
    return list;
  }, [ordered, base, routeId]);
  const save = useSitmasMutation(async () => {
    if (!route.isSuccess || route.isFetching || detail.isFetching || detail.isError) throw new Error('Actualizá el recorrido antes de guardar.');
    // Comprobar que nadie cambió las tareas mientras se calculaba el mapa.
    const fresh = currentTaskCoordinates(await sitmasApi.detalleHojaRuta(routeId), origins);
    if (JSON.stringify(fresh.map((t) => [t.Id_Detalle_HDR, t.Latitud, t.Longitud])) !== JSON.stringify(tasks.map((t) => [t.Id_Detalle_HDR, t.Latitud, t.Longitud]))) throw new Error('Las tareas cambiaron. Actualizá el recorrido antes de guardar.');
    await sitmasApi.actualizarDistanciaTotal(routeId, Number((route.data.distance / 1000).toFixed(2)));
  }, [keys.hojas]);
  const chosen = points.find((p) => p.stop.Id_Detalle_HDR === selected);
  return <View style={{ gap: 12 }}>
    <Text style={ui.muted}>EMEC → tareas → EMEC · El orden se recalcula al cambiar las tareas. Los kilómetros son estimados.</Text>
    {canAssign && <SelectField label="Asignar tarea pendiente a esta hoja" value={0} disabled={busy || save.isPending || !pending.length} options={pending.map((t) => ({ id: t.Id_Detalle_HDR, text: `#${t.Id_Detalle_HDR} · ${t.Origen || 'Tarea'} · ${t.TipoMaterial || 'General'}` }))} onChange={(id) => onAssign(id, routeId)} />}
    {detail.isError && <Text accessibilityRole="alert" style={ui.error}>No se pudieron actualizar las tareas.</Text>}
    {!base && <Text accessibilityRole="alert" style={ui.error}>No se encontró una única sede EMEC con coordenadas válidas en los orígenes de SITMAS.</Text>}
    {route.isFetching && <View style={ui.row}><ActivityIndicator color="#087947" /><Text style={ui.muted}>Buscando un recorrido más corto…</Text></View>}
    {route.isError && <Text accessibilityRole="alert" style={ui.error}>{route.error instanceof Error ? route.error.message : 'No se pudo calcular el circuito.'}</Text>}
    <RouteCanvas points={points} paths={route.isSuccess ? route.data.paths : []} selectedId={selected} fitVersion={fit} onSelect={setSelected} />
    <View style={ui.row}><Action title="Ver circuito completo" secondary onPress={() => setFit((v) => v + 1)} /><Action title="Actualizar recorrido" secondary disabled={route.isFetching || detail.isFetching || busy || save.isPending} onPress={() => { void (async () => { await client.invalidateQueries({ queryKey: keys.origenes }); await detail.refetch(); await client.invalidateQueries({ queryKey: ['optimizedRoute', routeId] }); })(); }} /></View>
    {chosen && <Text style={ui.notice}>{chosen.number ? `Tarea ${chosen.number} · ` : ''}{chosen.stop.Origen}</Text>}
    {route.data && !route.isError && <>
      <Text style={ui.title}>{(route.data.distance / 1000).toFixed(2)} km · {Math.round(route.data.duration / 60)} min de conducción</Text>
      <Text style={ui.muted}>{route.data.method === 'exact' ? 'Mejor orden según las distancias viales consultadas.' : 'Orden mejorado para reducir kilómetros.'} No incluye tiempos de carga, descarga ni tráfico en vivo.</Text>
      {canAssign && <Action title={save.isPending ? 'Guardando kilómetros…' : 'Guardar km calculados'} disabled={busy || save.isPending || route.isFetching || detail.isFetching || detail.isError} onPress={() => { setMessage(''); void save.run(undefined).then(() => setMessage('Total del circuito guardado en SITMAS.')).catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'No se pudo guardar el total.')); }} />}
    </>}
    {!!message && <Text accessibilityRole="alert" style={ui.notice}>{message}</Text>}
    <Text style={ui.title}>Orden de visita{route.isSuccess ? '' : ' · pendiente de cálculo'}</Text>
    <Text style={ui.text}>Salida · Sede EMEC</Text>
    {ordered.map((task, index) => <View key={task.Id_Detalle_HDR} style={{ padding: 12, borderRadius: 8, backgroundColor: '#f3f6f3', gap: 4 }}>
      <Text style={ui.text}>{route.isSuccess ? `${index + 1}. ` : ''}{task.Origen || `Tarea #${task.Id_Detalle_HDR}`}</Text>
      <Text style={ui.muted}>#{task.Id_Detalle_HDR} · {task.TipoMovimiento || 'Movimiento'} · {task.TipoMaterial || 'General'}{!validCoordinates(task) ? ' · Sin coordenadas' : ''}</Text>
    </View>)}
    {!tasks.length && !detail.isPending && <Text style={ui.muted}>Esta hoja todavía no tiene tareas.</Text>}
    <Text style={ui.text}>Regreso · Sede EMEC</Text>
  </View>;
}
