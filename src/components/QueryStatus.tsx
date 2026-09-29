import { Text } from './AppText';
import { ActivityIndicator, Pressable, View } from 'react-native';

type Status = {
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  fetchStatus: string;
  refetch: () => Promise<unknown>;
};

export default function QueryStatus({
  queries,
}: {
  queries: readonly Status[];
}) {
  const loading = queries.some((q) => q.isPending && q.isFetching);
  const failed = queries.some((q) => q.isError);
  const paused = queries.some((q) => q.fetchStatus === 'paused');
  const refreshing = queries.some((q) => q.isFetching);
  return (
    <View style={{ paddingVertical: 8, gap: 6 }}>
      {loading && (
        <ActivityIndicator
          color="#087a42"
          accessibilityLabel="Cargando datos"
        />
      )}
      {(failed || paused) && (
        <Text accessibilityRole="alert" style={{ color: '#b23030' }}>
          {paused
            ? 'Sin conexión. Reintentá al recuperar la conexión.'
            : 'No se pudieron actualizar algunos datos. Se conserva la última información disponible.'}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={refreshing}
        onPress={() => void Promise.all(queries.map((q) => q.refetch()))}
      >
        <Text style={{ color: '#007a33', fontWeight: '800', fontSize: 11 }}>
          {refreshing
            ? 'ACTUALIZANDO…'
            : failed || paused
              ? 'REINTENTAR'
              : '↻ ACTUALIZAR DATOS'}
        </Text>
      </Pressable>
    </View>
  );
}
