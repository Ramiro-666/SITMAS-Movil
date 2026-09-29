import { Text, TextInput } from '../AppText';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Ubicacion } from '../../services/sitmas-api';
import MapCanvas from './MapCanvas';
import type { MapPoint } from './types';

type Props = {
  locations: Ubicacion[];
  value: MapPoint | null;
  disabled: boolean;
  onChange: (point: MapPoint) => void;
};
export default function StopLocationPicker({
  locations,
  value,
  disabled,
  onChange,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Tocá un marcador para usar una ubicación guardada o un punto del mapa
        para elegir un lugar nuevo.
      </Text>
      <MapCanvas
        locations={locations}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
      <Text style={styles.label}>UBICACIONES GUARDADAS</Text>
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={styles.locations}
      >
        {locations.map((location) => (
          <Pressable
            accessibilityRole="button"
            key={location.IdUbicacion}
            disabled={disabled}
            accessibilityState={{
              selected: value?.IdUbicacion === location.IdUbicacion,
              disabled,
            }}
            onPress={() => onChange(location)}
            style={[
              styles.location,
              value?.IdUbicacion === location.IdUbicacion && styles.selected,
            ]}
          >
            <Text style={styles.text}>
              {location.Descripcion || `Ubicación #${location.IdUbicacion}`}
            </Text>
          </Pressable>
        ))}
        {!locations.length && (
          <Text style={styles.hint}>
            No hay ubicaciones guardadas disponibles.
          </Text>
        )}
      </ScrollView>
      {value && (
        <>
          <Text style={styles.label}>
            {value.IdUbicacion
              ? 'UBICACIÓN SELECCIONADA'
              : 'REFERENCIA DEL PUNTO NUEVO'}
          </Text>
          {value.IdUbicacion ? (
            <Text style={styles.text}>{value.Descripcion}</Text>
          ) : (
            <TextInput
              editable={!disabled}
              accessibilityLabel="Referencia de la ubicación"
              placeholder="Ej.: ingreso al predio por calle principal"
              value={value.Descripcion}
              onChangeText={(Descripcion) =>
                onChange({ ...value, Descripcion })
              }
              style={styles.input}
            />
          )}
          <Text style={styles.hint}>
            {value.Latitud.toFixed(5)}, {value.Longitud.toFixed(5)}
          </Text>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 8, marginTop: 8 },
  hint: { color: '#637f8d', fontSize: 11 },
  label: { color: '#006d38', fontSize: 10, fontWeight: '800', marginTop: 8 },
  locations: {
    maxHeight: 132,
    borderWidth: 1,
    borderColor: '#cbdde1',
    borderRadius: 8,
  },
  location: { padding: 10, borderBottomWidth: 1, borderColor: '#e6eee9' },
  selected: { backgroundColor: '#d5eee0' },
  text: { color: '#173542', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#cbdde1',
    borderRadius: 8,
    minHeight: 45,
    paddingHorizontal: 12,
    color: '#173542',
  },
});
