import { Text, TextInput } from './AppText';
import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  CatalogItem,
  HojaRuta,
  Parada,
  sitmasApi,
} from '../services/sitmas-api';

import { useQueryClient } from '@tanstack/react-query';
import {
  keys,
  queries,
  useSitmasMutation,
  useSitmasQuery,
} from '../query/sitmas';
import QueryStatus from './QueryStatus';
import StopLocationPicker from './maps/StopLocationPicker';
import { validCoordinates, type MapPoint } from './maps/types';
import { saveStopWithLocation } from '../services/save-stop';

const START = 6 * 60;
const END = 22 * 60;
const SLOT_HEIGHT = 40;
const minutes = (value?: string) => {
  const found = /^(\d{1,2}):(\d{2})/.exec(value || '');
  return found ? Number(found[1]) * 60 + Number(found[2]) : START;
};
const time = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}:00`;
const dateISO = (route?: HojaRuta | null) => {
  if (route?.HojaRutaFecha && !route.HojaRutaFecha.startsWith('0001'))
    return route.HojaRutaFecha.slice(0, 10);
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(
    route?.FechaFormateada || '',
  );
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
};
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const validTime = (value: string) => {
  const found = /^(\d{2}):(\d{2})$/.exec(value);
  return !!found && Number(found[1]) < 24 && Number(found[2]) < 60;
};
const idOf = (item: CatalogItem, key: string) =>
  Number(item[key] ?? item.Id ?? 0);
const labelOf = (item: CatalogItem, key: string) =>
  String(item[key] ?? 'Sin descripción');

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  disabled?: boolean;
  label: string;
  value: number;
  options: { id: number; text: string }[];
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.select}
        disabled={disabled}
        onPress={() => setOpen(!open)}
      >
        <Text style={styles.selectText}>
          {options.find((x) => x.id === value)?.text ||
            `Seleccionar ${label.toLowerCase()}`}
        </Text>
        <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && (
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          style={styles.options}
        >
          {options.map((x) => (
            <Pressable
              disabled={disabled}
              key={x.id}
              onPress={() => {
                onChange(x.id);
                setOpen(false);
              }}
              style={styles.option}
            >
              <Text style={styles.selectText}>{x.text}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function StopBlock({
  stop,
  onDrop,
  onOpen,
}: {
  stop: Parada;
  onDrop: (stop: Parada, deltaY: number) => void;
  onOpen: (stop: Parada) => void;
}) {
  const offset = useRef(new Animated.Value(0)).current;
  const start = Math.max(
    START,
    Math.min(
      END - 30,
      minutes(stop.HoraEstimadaFormateada || stop.HoraEstimada),
    ),
  );
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 7,
        onPanResponderMove: (_, g) => offset.setValue(g.dy),
        onPanResponderRelease: (_, g) => {
          offset.setValue(0);
          if (Math.abs(g.dy) > 15) onDrop(stop, g.dy);
        },
        onPanResponderTerminate: () => offset.setValue(0),
      }),
    [offset, onDrop, stop],
  );
  return (
    <Animated.View
      {...pan.panHandlers}
      style={[
        styles.stop,
        {
          top: ((start - START) / 30) * SLOT_HEIGHT,
          transform: [{ translateY: offset }],
        },
      ]}
    >
      <Pressable onPress={() => onOpen(stop)}>
        <Text style={styles.stopTime}>
          {time(start).slice(0, 5)} · {stop.EstadoRecorrido || 'Pendiente'}
        </Text>
        <Text style={styles.stopName}>
          {stop.Origen || 'Origen sin descripción'}
        </Text>
        <Text style={styles.stopDetail}>
          {stop.TipoMovimiento || 'Movimiento'} ·{' '}
          {stop.TipoMaterial || 'Material'}
        </Text>
        <Text style={styles.dragHint}>
          ↕ Arrastrar para cambiar la hora · Tocar para editar
        </Text>
      </Pressable>
    </Animated.View>
  );
}

type StopDraft = Pick<
  Parada,
  | 'Id_TipoMovimiento'
  | 'Id_RecursoMov'
  | 'Id_Origen'
  | 'Id_TipoMaterial'
  | 'Id_Estado'
  | 'HoraEstimada'
>;
const emptyStop: StopDraft = {
  Id_TipoMovimiento: 0,
  Id_RecursoMov: 0,
  Id_Origen: 0,
  Id_TipoMaterial: 0,
  Id_Estado: 0,
  HoraEstimada: '08:00:00',
};

export default function RoutePlanner({
  header,
  footer,
}: {
  header: React.ReactElement;
  footer: React.ReactElement;
}) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const routesQuery = useSitmasQuery(queries.hojas);
  const vehiclesQuery = useSitmasQuery(queries.vehiculos);
  const driversQuery = useSitmasQuery(queries.choferes);
  const movementQuery = useSitmasQuery(queries.movimientos);
  const resourceQuery = useSitmasQuery(queries.recursos);
  const originQuery = useSitmasQuery(queries.origenes);
  const materialQuery = useSitmasQuery(queries.materiales);
  const stateQuery = useSitmasQuery(queries.estados);
  const detailQuery = useSitmasQuery(
    queries.hoja(selectedId ?? 0),
    selectedId !== null,
  );
  const stopsQuery = useSitmasQuery(
    queries.paradas(selectedId ?? 0),
    selectedId !== null,
  );
  const routes = routesQuery.data ?? [],
    vehicles = vehiclesQuery.data ?? [],
    drivers = driversQuery.data ?? [];
  const summary = routes.find((route) => route.Id === selectedId);
  const selected = detailQuery.data
    ? {
        ...summary,
        ...detailQuery.data,
        FechaFormateada:
          summary?.FechaFormateada || detailQuery.data.FechaFormateada,
        Vehiculo: summary?.Vehiculo || detailQuery.data.Vehiculo,
        ChoferNombreCompleto:
          summary?.ChoferNombreCompleto ||
          detailQuery.data.ChoferNombreCompleto,
      }
    : null;
  const stops = stopsQuery.data ?? [];
  const catalogs = {
    movement: movementQuery.data ?? [],
    resource: resourceQuery.data ?? [],
    origin: originQuery.data ?? [],
    material: materialQuery.data ?? [],
    state: stateQuery.data ?? [],
  };
  const operation = useSitmasMutation(
    async (action: () => Promise<unknown>) => action(),
    [keys.hojas, keys.ubicaciones],
  );
  const busy = operation.isPending;
  const [confirmation, setConfirmation] = useState<{
    kind: 'route' | 'stop';
    id: number;
  } | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [routeFormOpen, setRouteFormOpen] = useState(false);
  const [routeDraft, setRouteDraft] = useState({
    date: '',
    vehicle: 0,
    driver: 0,
  });
  const [editingRoute, setEditingRoute] = useState<number | null>(null);
  const [stopFormOpen, setStopFormOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Parada | null>(null);
  const [stopDraft, setStopDraft] = useState<StopDraft>(emptyStop);
  const [locationMode, setLocationMode] = useState(false);
  const [locationDraft, setLocationDraft] = useState<MapPoint | null>(null);
  const locationsQuery = useSitmasQuery(
    queries.ubicaciones,
    stopFormOpen && locationMode,
  );
  const selectedLocation =
    locationDraft ??
    locationsQuery.data?.find(
      (location) => location.IdUbicacion === editingStop?.Id_Ubicacion,
    ) ??
    null;
  const [moveStop, setMoveStop] = useState<Parada | null>(null);
  const [moveDate, setMoveDate] = useState('');
  const [moveTime, setMoveTime] = useState('');
  const [keepResources, setKeepResources] = useState(true);
  const [moveVehicle, setMoveVehicle] = useState(0);
  const [moveDriver, setMoveDriver] = useState(0);
  const [error, setError] = useState('');

  function choose(route: HojaRuta) {
    if (busy) return;
    setSelectedId(route.Id);
    setError('');
    setListOpen(false);
    setStopFormOpen(false);
    setMoveStop(null);
    setRouteFormOpen(false);
  }
  function editRoute() {
    if (!selected) return;
    setEditingRoute(selected.Id);
    setRouteDraft({
      date: dateISO(selected),
      vehicle: selected.Id_Vehiculo || 0,
      driver: selected.Id_Chofer || 0,
    });
    setRouteFormOpen(true);
  }
  async function saveRoute() {
    if (busy) return;
    if (
      !validDate(routeDraft.date) ||
      !routeDraft.vehicle ||
      !routeDraft.driver
    ) {
      setError('Seleccioná una fecha válida, vehículo y chofer.');
      return;
    }
    setError('');
    try {
      const payload = {
        HojaRutaFecha: routeDraft.date,
        Id_Vehiculo: routeDraft.vehicle,
        Id_Chofer: routeDraft.driver,
      };
      await operation.run(() =>
        editingRoute
          ? sitmasApi.actualizarHojaRuta(editingRoute, payload)
          : sitmasApi.crearHojaRuta(payload),
      );
      setRouteFormOpen(false);
      setEditingRoute(null);
      setRouteDraft({ date: '', vehicle: 0, driver: 0 });
    } catch {
      setError(
        'No se pudo confirmar el guardado. Revisá los datos y el listado antes de reintentar.',
      );
    }
  }
  function askDeleteRoute() {
    if (selected && !busy) setConfirmation({ kind: 'route', id: selected.Id });
  }
  function editStop(stop?: Parada) {
    if (busy) return;
    setError('');
    setEditingStop(stop || null);
    setLocationMode(!!stop?.Id_Ubicacion);
    setLocationDraft(
      stop?.Id_Ubicacion && validCoordinates(stop)
        ? {
            IdUbicacion: stop.Id_Ubicacion,
            Latitud: stop.Latitud!,
            Longitud: stop.Longitud!,
            Descripcion: stop.Origen || 'Ubicación de la parada',
          }
        : null,
    );
    setStopDraft(
      stop
        ? {
            Id_TipoMovimiento: stop.Id_TipoMovimiento,
            Id_RecursoMov: stop.Id_RecursoMov,
            Id_Origen: stop.Id_Origen,
            Id_TipoMaterial: stop.Id_TipoMaterial,
            Id_Estado: stop.Id_Estado,
            HoraEstimada:
              stop.HoraEstimadaFormateada || stop.HoraEstimada || '08:00:00',
          }
        : emptyStop,
    );
    setStopFormOpen(true);
  }
  async function saveStop() {
    if (busy) return;
    if (
      !selected ||
      !stopDraft.Id_TipoMovimiento ||
      (!locationMode &&
        (!stopDraft.Id_RecursoMov ||
          !stopDraft.Id_Origen ||
          !stopDraft.Id_TipoMaterial)) ||
      (locationMode &&
        (!selectedLocation ||
          !validCoordinates(selectedLocation) ||
          !selectedLocation.Descripcion.trim())) ||
      !stopDraft.Id_Estado ||
      !validTime((stopDraft.HoraEstimada || '').slice(0, 5))
    ) {
      setError('Completá los datos de la parada y una hora válida.');
      return;
    }
    setError('');
    try {
      const payload = {
        ...editingStop,
        ...stopDraft,
        HoraEstimada: time(minutes(stopDraft.HoraEstimada)),
        Id_HojaRuta: selected.Id,
      };
      await operation.run(() =>
        saveStopWithLocation(
          payload,
          locationMode ? selectedLocation : null,
          setLocationDraft,
        ),
      );
      setStopFormOpen(false);
      setEditingStop(null);
    } catch {
      setError(
        'No se pudo confirmar la parada. Conservamos el formulario y cualquier ubicación ya creada; revisá la agenda antes de reintentar.',
      );
    }
  }
  function askDeleteStop() {
    if (editingStop && !busy)
      setConfirmation({ kind: 'stop', id: editingStop.Id_Detalle_HDR });
  }
  async function confirmDelete() {
    if (!confirmation || busy) return;
    const target = confirmation;
    setError('');
    try {
      await operation.run(async () => {
        if (target.kind === 'route') {
          await sitmasApi.borrarHojaRuta(target.id);
          setSelectedId(null);
          setListOpen(true);
          client.removeQueries({ queryKey: keys.hoja(target.id) });
        } else await sitmasApi.borrarParada(target.id);
      });
      setConfirmation(null);
      setStopFormOpen(false);
    } catch {
      setError(
        'No se pudo confirmar la eliminación. Revisá el listado antes de reintentar.',
      );
      setConfirmation(null);
    }
  }
  async function drop(stop: Parada, deltaY: number) {
    if (!selected || busy) return;
    const current = minutes(stop.HoraEstimadaFormateada || stop.HoraEstimada);
    const next = Math.max(
      START,
      Math.min(
        END - 30,
        Math.round((current + (deltaY * 30) / SLOT_HEIGHT) / 30) * 30,
      ),
    );
    if (next === current) return;
    setError('');
    // Conservamos el horario confirmado hasta que el servidor acepte el cambio.
    try {
      await operation.run(() =>
        sitmasApi.actualizarParada({ ...stop, HoraEstimada: time(next) }),
      );
    } catch {
      setError(
        'No se pudo confirmar el nuevo horario. Se volvió a consultar la agenda.',
      );
    }
  }
  function openMove(stop: Parada) {
    if (busy) return;
    setError('');
    setMoveStop(stop);
    setMoveDate(dateISO(selected));
    setMoveTime(
      (stop.HoraEstimadaFormateada || stop.HoraEstimada || '08:00').slice(0, 5),
    );
    setKeepResources(true);
    setMoveVehicle(selected?.Id_Vehiculo || 0);
    setMoveDriver(selected?.Id_Chofer || 0);
  }
  async function confirmMove() {
    if (busy) return;
    if (
      !moveStop ||
      !selected ||
      !validDate(moveDate) ||
      !validTime(moveTime) ||
      !moveVehicle ||
      !moveDriver
    ) {
      setError('Ingresá fecha, hora, vehículo y chofer válidos.');
      return;
    }
    setError('');
    try {
      await operation.run(async () => {
        let destinationId = selected.Id;
        const sameAssignment =
          moveDate === dateISO(selected) &&
          moveVehicle === selected.Id_Vehiculo &&
          moveDriver === selected.Id_Chofer;
        if (!sameAssignment) {
          const freshRoutes = await client.fetchQuery({
            ...queries.hojas,
            staleTime: 0,
          });
          const candidates = freshRoutes.filter(
            (route) => dateISO(route) === moveDate,
          );
          const headers = await Promise.all(
            candidates.map((route) =>
              client.fetchQuery({ ...queries.hoja(route.Id), staleTime: 0 }),
            ),
          );
          const existing = headers.find(
            (route) =>
              route.Id_Vehiculo === moveVehicle &&
              route.Id_Chofer === moveDriver,
          );
          destinationId =
            existing?.Id ||
            (
              await sitmasApi.crearHojaRuta({
                HojaRutaFecha: moveDate,
                Id_Vehiculo: moveVehicle,
                Id_Chofer: moveDriver,
              })
            ).IdGenerado;
          if (!destinationId)
            throw new Error(
              'El servidor no devolvió el ID de la hoja destino.',
            );
        }
        await sitmasApi.actualizarParada({
          ...moveStop,
          Id_HojaRuta: destinationId,
          HoraEstimada: time(minutes(moveTime)),
        });
      });
      setMoveStop(null);
    } catch {
      setError(
        'No se pudo confirmar el traslado. Se actualizaron las hojas; si se creó una nueva, verificá su estado antes de reintentar.',
      );
    }
  }

  const vehiclesOptions = vehicles.map((v) => ({ id: v.Id, text: v.Patente }));
  const driversOptions = drivers.map((d) => ({
    id: d.Id,
    text: `${d.Apellido || ''} ${d.Nombre || ''}`.trim(),
  }));
  const statusQueries = [
    routesQuery,
    vehiclesQuery,
    driversQuery,
    movementQuery,
    resourceQuery,
    originQuery,
    materialQuery,
    stateQuery,
    ...(selectedId !== null ? [detailQuery] : []),
  ];
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        data={listOpen ? routes : []}
        keyExtractor={(route) => String(route.Id)}
        ListHeaderComponent={
          <>
            {header}
            <QueryStatus queries={statusQueries} />{' '}
            <View style={styles.topBar}>
              <Text style={styles.title}>HOJAS DE RUTA</Text>
              <Pressable
                disabled={busy}
                onPress={() => {
                  setEditingRoute(null);
                  setRouteDraft({ date: '', vehicle: 0, driver: 0 });
                  setRouteFormOpen(!routeFormOpen);
                }}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>+ NUEVA</Text>
              </Pressable>
            </View>
            {!!error && <Text style={styles.error}>{error}</Text>}
            {routeFormOpen && (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>
                  {editingRoute ? 'Editar hoja de ruta' : 'Nueva hoja de ruta'}
                </Text>
                <Text style={styles.label}>FECHA · AAAA-MM-DD</Text>
                <TextInput
                  editable={!busy}
                  value={routeDraft.date}
                  onChangeText={(date) =>
                    setRouteDraft((d) => ({ ...d, date }))
                  }
                  placeholder="2026-09-16"
                  style={styles.input}
                />
                <SelectField
                  disabled={busy}
                  label="Vehículo"
                  value={routeDraft.vehicle}
                  options={vehiclesOptions}
                  onChange={(vehicle) =>
                    setRouteDraft((d) => ({ ...d, vehicle }))
                  }
                />
                <SelectField
                  disabled={busy}
                  label="Chofer"
                  value={routeDraft.driver}
                  options={driversOptions}
                  onChange={(driver) =>
                    setRouteDraft((d) => ({ ...d, driver }))
                  }
                />
                <Pressable
                  disabled={busy}
                  onPress={saveRoute}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>
                    {editingRoute ? 'GUARDAR CAMBIOS' : 'CREAR HOJA'}
                  </Text>
                </Pressable>
              </View>
            )}
            <View style={styles.panel}>
              <Pressable
                disabled={busy}
                onPress={() => setListOpen(!listOpen)}
                style={styles.listHeader}
              >
                <Text style={styles.panelTitle}>HOJAS DE RUTA EXISTENTES</Text>
                <Text style={styles.chevron}>{listOpen ? '⌃' : '⌄'}</Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item: route }) => (
          <Pressable
            key={route.Id}
            onPress={() => choose(route)}
            style={styles.routeRow}
          >
            <Text style={styles.routeId}>HR-{route.Id}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeMain}>
                {route.FechaFormateada || dateISO(route)} · {route.Vehiculo}
              </Text>
              <Text style={styles.small}>{route.ChoferNombreCompleto}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          listOpen && routesQuery.isSuccess ? (
            <Text style={styles.small}>No hay hojas de ruta.</Text>
          ) : null
        }
        ListFooterComponent={
          <>
            {selected && (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>
                  HOJA #{selected.Id} · {selected.FechaFormateada}
                </Text>
                <Text style={styles.small}>
                  {selected.Vehiculo} · {selected.ChoferNombreCompleto}
                </Text>
                <View style={styles.actions}>
                  <Pressable
                    disabled={busy}
                    onPress={editRoute}
                    style={styles.outline}
                  >
                    <Text style={styles.outlineText}>EDITAR HOJA</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={askDeleteRoute}
                    style={styles.outline}
                  >
                    <Text style={styles.deleteText}>ELIMINAR</Text>
                  </Pressable>
                </View>
                <View style={styles.actions}>
                  <Text style={styles.panelTitle}>PARADAS · AGENDA</Text>
                  <Pressable
                    disabled={busy}
                    onPress={() => editStop()}
                    style={styles.primary}
                  >
                    <Text style={styles.primaryText}>+ PARADA</Text>
                  </Pressable>
                </View>
                <Text style={styles.small}>
                  Arrastrá una tarjeta para cambiar su horario. Tocala para
                  editarla.
                </Text>
                <QueryStatus queries={[stopsQuery]} />
                <View style={styles.calendar}>
                  {Array.from({ length: 32 }, (_, i) => (
                    <View key={i} style={styles.slot}>
                      <Text style={styles.slotTime}>
                        {time(START + i * 30).slice(0, 5)}
                      </Text>
                      <View style={styles.slotLine} />
                    </View>
                  ))}
                  {stops.map((stop) => (
                    <StopBlock
                      key={stop.Id_Detalle_HDR}
                      stop={stop}
                      onDrop={drop}
                      onOpen={editStop}
                    />
                  ))}
                </View>
                {stopsQuery.isSuccess && stops.length === 0 && (
                  <Text style={styles.small}>
                    Esta hoja todavía no tiene paradas.
                  </Text>
                )}
              </View>
            )}
            {footer}
          </>
        }
      />
      <Modal
        transparent
        visible={stopFormOpen && !!selected}
        onRequestClose={() => {
          if (!busy) setStopFormOpen(false);
        }}
        animationType="slide"
      >
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.panel}>
              {!!error && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              )}
              <Text style={styles.panelTitle}>
                {editingStop
                  ? `EDITAR PARADA #${editingStop.Id_Detalle_HDR}`
                  : 'AGREGAR PARADA'}
              </Text>
              <SelectField
                disabled={busy}
                label="Tipo de movimiento"
                value={stopDraft.Id_TipoMovimiento}
                options={catalogs.movement.map((x) => ({
                  id: idOf(x, 'IdTipoMovimientos'),
                  text: labelOf(x, 'TipoMovimientos'),
                }))}
                onChange={(v) =>
                  setStopDraft((d) => ({ ...d, Id_TipoMovimiento: v }))
                }
              />
              <SelectField
                disabled={busy}
                label={
                  locationMode
                    ? 'Recurso movilizado (opcional)'
                    : 'Recurso movilizado'
                }
                value={stopDraft.Id_RecursoMov}
                options={catalogs.resource.map((x) => ({
                  id: idOf(x, 'IdRecursoMov'),
                  text: labelOf(x, 'Recurso_Movilizado'),
                }))}
                onChange={(v) =>
                  setStopDraft((d) => ({ ...d, Id_RecursoMov: v }))
                }
              />
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: !locationMode }}
                  disabled={busy}
                  style={styles.outline}
                  onPress={() => setLocationMode(false)}
                >
                  <Text style={styles.outlineText}>
                    {!locationMode ? '✓ ' : ''}ORIGEN
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: locationMode }}
                  disabled={busy}
                  style={styles.outline}
                  onPress={() => setLocationMode(true)}
                >
                  <Text style={styles.outlineText}>
                    {locationMode ? '✓ ' : ''}ELEGIR EN MAPA
                  </Text>
                </Pressable>
              </View>
              {locationMode ? (
                <>
                  <QueryStatus queries={[locationsQuery]} />
                  <StopLocationPicker
                    locations={locationsQuery.data ?? []}
                    value={selectedLocation}
                    disabled={busy}
                    onChange={setLocationDraft}
                  />
                </>
              ) : (
                <SelectField
                  disabled={busy}
                  label="Lugar / origen"
                  value={stopDraft.Id_Origen}
                  options={catalogs.origin.map((x) => ({
                    id: idOf(x, 'IdOrigen'),
                    text: labelOf(x, 'EmpresaInstitucion'),
                  }))}
                  onChange={(v) =>
                    setStopDraft((d) => ({ ...d, Id_Origen: v }))
                  }
                />
              )}
              <SelectField
                disabled={busy}
                label={
                  locationMode ? 'Tipo material (opcional)' : 'Tipo material'
                }
                value={stopDraft.Id_TipoMaterial}
                options={catalogs.material.map((x) => ({
                  id: idOf(x, 'IdTipoMaterial'),
                  text: labelOf(x, 'TipoMaterial'),
                }))}
                onChange={(v) =>
                  setStopDraft((d) => ({ ...d, Id_TipoMaterial: v }))
                }
              />
              <Text style={styles.label}>HORA ESTIMADA · HH:MM</Text>
              <TextInput
                editable={!busy}
                value={(stopDraft.HoraEstimada || '').slice(0, 5)}
                onChangeText={(v) =>
                  setStopDraft((d) => ({ ...d, HoraEstimada: v }))
                }
                placeholder="08:00"
                style={styles.input}
              />
              <SelectField
                disabled={busy}
                label="Estado"
                value={stopDraft.Id_Estado}
                options={catalogs.state.map((x) => ({
                  id: idOf(x, 'Id'),
                  text: labelOf(x, 'EstadoHojaRuta'),
                }))}
                onChange={(v) => setStopDraft((d) => ({ ...d, Id_Estado: v }))}
              />
              <View style={styles.actions}>
                <Pressable
                  disabled={busy}
                  onPress={() => setStopFormOpen(false)}
                  style={styles.outline}
                >
                  <Text style={styles.outlineText}>CANCELAR</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={saveStop}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>GUARDAR PARADA</Text>
                </Pressable>
              </View>
              {editingStop && (
                <View style={styles.actions}>
                  <Pressable
                    disabled={busy}
                    onPress={() => {
                      setStopFormOpen(false);
                      openMove(editingStop);
                    }}
                    style={styles.outline}
                  >
                    <Text style={styles.outlineText}>CAMBIAR DÍA</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={askDeleteStop}
                    style={styles.outline}
                  >
                    <Text style={styles.deleteText}>ELIMINAR PARADA</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
      <Modal
        transparent
        visible={!!moveStop}
        onRequestClose={() => {
          if (!busy) setMoveStop(null);
        }}
        animationType="slide"
      >
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.panel}>
              {!!error && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              )}
              <Text style={styles.panelTitle}>
                REPROGRAMAR PARADA #{moveStop?.Id_Detalle_HDR}
              </Text>
              <Text style={styles.label}>NUEVA FECHA · AAAA-MM-DD</Text>
              <TextInput
                editable={!busy}
                value={moveDate}
                onChangeText={setMoveDate}
                style={styles.input}
              />
              <Text style={styles.label}>NUEVA HORA · HH:MM</Text>
              <TextInput
                editable={!busy}
                value={moveTime}
                onChangeText={setMoveTime}
                style={styles.input}
              />
              <Text style={styles.question}>
                ¿Desea conservar los datos del vehículo y/o chofer?
              </Text>
              <View style={styles.actions}>
                <Pressable
                  disabled={busy}
                  onPress={() => {
                    setKeepResources(true);
                    setMoveVehicle(selected?.Id_Vehiculo || 0);
                    setMoveDriver(selected?.Id_Chofer || 0);
                  }}
                  style={styles.outline}
                >
                  <Text style={styles.outlineText}>
                    {keepResources ? '✓ ' : ''}CONSERVAR
                  </Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={() => setKeepResources(false)}
                  style={styles.outline}
                >
                  <Text style={styles.outlineText}>
                    {!keepResources ? '✓ ' : ''}CAMBIAR
                  </Text>
                </Pressable>
              </View>
              {!keepResources && (
                <>
                  <SelectField
                    disabled={busy}
                    label="Vehículo nuevo"
                    value={moveVehicle}
                    options={vehiclesOptions}
                    onChange={setMoveVehicle}
                  />
                  <SelectField
                    disabled={busy}
                    label="Chofer nuevo"
                    value={moveDriver}
                    options={driversOptions}
                    onChange={setMoveDriver}
                  />
                </>
              )}
              <View style={styles.actions}>
                <Pressable
                  disabled={busy}
                  onPress={() => setMoveStop(null)}
                  style={styles.outline}
                >
                  <Text style={styles.outlineText}>CANCELAR</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={confirmMove}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>CONFIRMAR</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
      <Modal
        transparent
        visible={!!confirmation}
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setConfirmation(null);
        }}
      >
        <View
          style={[
            styles.modalBackdrop,
            { justifyContent: 'center', padding: 24 },
          ]}
        >
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>
              {confirmation?.kind === 'route'
                ? 'Eliminar hoja y sus paradas'
                : 'Eliminar parada'}
            </Text>
            <Text style={styles.small}>Esta acción no se puede deshacer.</Text>
            <View style={styles.actions}>
              <Pressable
                disabled={busy}
                style={styles.outline}
                onPress={() => setConfirmation(null)}
              >
                <Text style={styles.outlineText}>CANCELAR</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                style={styles.primary}
                onPress={() => void confirmDelete()}
              >
                <Text style={styles.primaryText}>
                  {busy ? 'ELIMINANDO…' : 'CONFIRMAR ELIMINACIÓN'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { color: '#006d38', fontWeight: '800', fontSize: 17 },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  panelTitle: {
    color: '#006d38',
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 28,
  },
  routeRow: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#e5eee8',
  },
  routeId: { color: '#662d91', fontWeight: '800', fontSize: 11 },
  routeMain: { color: '#1b3d45', fontSize: 12, fontWeight: '700' },
  small: { color: '#6c8390', fontSize: 11, marginTop: 4 },
  label: {
    color: '#006d38',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 5,
  },
  fieldGroup: { marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbdde1',
    height: 45,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#173542',
  },
  select: {
    borderWidth: 1,
    borderColor: '#cbdde1',
    minHeight: 45,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { color: '#173542', fontSize: 12, flexShrink: 1 },
  chevron: { color: '#006d38', fontSize: 18, fontWeight: '700' },
  options: {
    borderWidth: 1,
    borderColor: '#dce8df',
    borderRadius: 8,
    maxHeight: 220,
    overflow: 'hidden',
  },
  option: { padding: 11, borderBottomWidth: 1, borderColor: '#e6eee9' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  primary: {
    backgroundColor: '#007b3e',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  outline: {
    borderWidth: 1,
    borderColor: '#a7c9bb',
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  outlineText: { color: '#006d38', fontSize: 10, fontWeight: '800' },
  deleteText: { color: '#b62d31', fontSize: 10, fontWeight: '800' },
  error: { color: '#b62d31', fontSize: 11, marginBottom: 10 },
  calendar: { height: 32 * SLOT_HEIGHT, position: 'relative', marginTop: 14 },
  slot: { height: SLOT_HEIGHT, flexDirection: 'row' },
  slotTime: { color: '#758790', width: 44, fontSize: 10 },
  slotLine: {
    borderTopWidth: 1,
    borderColor: '#e4ebe8',
    flex: 1,
    marginTop: 6,
  },
  stop: {
    position: 'absolute',
    left: 48,
    right: 0,
    minHeight: 62,
    borderRadius: 8,
    backgroundColor: '#087947',
    borderLeftWidth: 5,
    borderColor: '#73bd28',
    padding: 7,
    elevation: 4,
    zIndex: 1,
  },
  stopTime: { color: '#c7f1d6', fontWeight: '800', fontSize: 10 },
  stopName: { color: '#fff', fontWeight: '800', fontSize: 12 },
  stopDetail: { color: '#ebfff2', fontSize: 10 },
  dragHint: { color: '#d5eee0', fontSize: 9, marginTop: 4 },
  question: {
    color: '#1b3d45',
    fontWeight: '800',
    fontSize: 12,
    marginTop: 15,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(12,35,42,.6)' },
  modalContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 18,
    paddingVertical: 40,
  },
});
