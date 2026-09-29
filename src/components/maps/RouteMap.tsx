import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text } from '../AppText';
import RouteCanvas from './RouteCanvas';
import {
  fetchRoadRoute,
  orderStops,
  routeSegments,
  routingEndpoint,
  type Coordinate,
} from '../../services/route-geometry';
import type { Parada } from '../../services/sitmas-api';

const EMPTY_PATHS: Coordinate[][] = [];
export default function RouteMap({
  routeId,
  stops,
  loading,
  failed,
  disabled,
  onEdit,
}: {
  routeId: number;
  stops: Parada[];
  loading: boolean;
  failed: boolean;
  disabled: boolean;
  onEdit: (stop: Parada) => void;
}) {
  const points = useMemo(() => orderStops(stops), [stops]);
  const segments = useMemo(() => routeSegments(points), [points]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fitVersion, setFitVersion] = useState(0);
  const route = useQuery({
    queryKey: ['recorridoVial', routeId, routingEndpoint, segments],
    queryFn: ({ signal }) => fetchRoadRoute(segments, signal),
    enabled: segments.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const selected = points.find(
    (point) => point.stop.Id_Detalle_HDR === selectedId,
  );
  const missing = points.filter((point) => !point.coordinate).length;
  const mapped = points.length - missing;
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>RECORRIDO DE LA HOJA</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFitVersion((v) => v + 1)}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Ver recorrido completo</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Paradas numeradas por horario · Tocá un punto para ver su detalle.
      </Text>
      <RouteCanvas
        points={points}
        paths={
          segments.length ? (route.data?.paths ?? EMPTY_PATHS) : EMPTY_PATHS
        }
        selectedId={selected?.stop.Id_Detalle_HDR ?? null}
        fitVersion={fitVersion}
        onSelect={setSelectedId}
      />
      <View style={styles.status} accessibilityLiveRegion="polite">
        {loading ? (
          <Text style={styles.hint}>Cargando paradas…</Text>
        ) : failed && !stops.length ? (
          <Text style={styles.warning}>
            No se pudieron cargar las paradas. Reintentá desde el aviso de
            conexión.
          </Text>
        ) : !stops.length ? (
          <Text style={styles.hint}>Esta hoja todavía no tiene paradas.</Text>
        ) : (
          <Text style={styles.hint}>
            {mapped} de {stops.length} paradas en el mapa
            {mapped === 1
              ? ' · Una sola ubicación: no hay tramo para trazar.'
              : ''}
          </Text>
        )}
        {missing > 0 && (
          <Text style={styles.warning}>
            Recorrido incompleto: {missing} parada(s) sin coordenadas.
            Consultalas en la agenda.
          </Text>
        )}
        {route.isFetching && (
          <View style={styles.row}>
            <ActivityIndicator size="small" />
            <Text style={styles.hint}>Calculando recorrido vial…</Text>
          </View>
        )}
        {route.isError && (
          <View style={styles.row}>
            <Text style={styles.warning}>
              No se pudo calcular el recorrido. Los puntos siguen disponibles.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void route.refetch()}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Reintentar recorrido</Text>
            </Pressable>
          </View>
        )}
        {!!route.data && segments.length > 0 && (
          <Text style={styles.hint}>
            {missing ? 'Tramos disponibles' : 'Recorrido'}:{' '}
            {(route.data.distance / 1000).toFixed(1)} km ·{' '}
            {Math.round(route.data.duration / 60)} min estimados de conducción
          </Text>
        )}
      </View>
      <View style={styles.detail}>
        {selected ? (
          <>
            <Text style={styles.title}>
              PARADA {selected.number} ·{' '}
              {selected.stop.Origen || 'Punto en mapa'}
            </Text>
            <Text style={styles.hint}>
              {selected.stop.HoraEstimadaFormateada ||
                selected.stop.HoraEstimada ||
                'Sin horario'}{' '}
              · {selected.stop.EstadoRecorrido || 'Pendiente'} ·{' '}
              {selected.stop.TipoMovimiento || 'Movimiento'}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => onEdit(selected.stop)}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Editar esta parada</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.hint}>
            Seleccioná una parada en el mapa para consultar su horario y estado.
          </Text>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { marginTop: 22, marginBottom: 22, gap: 10 },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  title: { color: '#006d38', fontSize: 13, fontWeight: '800' },
  hint: { color: '#637f8d', fontSize: 12 },
  button: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#a7c9bb',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonText: { color: '#006d38', fontSize: 12, fontWeight: '700' },
  status: { minHeight: 50, gap: 6 },
  warning: { color: '#98600c', fontSize: 12, flexShrink: 1 },
  detail: {
    minHeight: 116,
    padding: 12,
    gap: 8,
    backgroundColor: '#f0f7f3',
    borderRadius: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
