import { useEffect, useRef } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { CORDOBA, validCoordinates, type MapCanvasProps } from './types';

export default function MapCanvas({
  locations,
  value,
  disabled,
  onChange,
}: MapCanvasProps) {
  const map = useRef<MapView>(null);
  const latitude = value?.Latitud;
  const longitude = value?.Longitud;
  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) {
      map.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.035, longitudeDelta: 0.035 },
        250,
      );
    }
  }, [latitude, longitude]);
  return (
    <MapView
      ref={map}
      style={{ width: '100%', height: 300 }}
      initialRegion={{ ...CORDOBA, latitudeDelta: 0.09, longitudeDelta: 0.09 }}
      onPress={(event) => {
        if (disabled || event.nativeEvent.action === 'marker-press') return;
        const { latitude: Latitud, longitude: Longitud } =
          event.nativeEvent.coordinate;
        onChange({ Latitud, Longitud, Descripcion: '' });
      }}
    >
      {locations.filter(validCoordinates).map((location) => (
        <Marker
          key={location.IdUbicacion}
          coordinate={{
            latitude: location.Latitud,
            longitude: location.Longitud,
          }}
          title={location.Descripcion}
          pinColor={
            value?.IdUbicacion === location.IdUbicacion ? '#007b3e' : '#0054a6'
          }
          onPress={(event) => {
            event.stopPropagation();
            if (!disabled) onChange(location);
          }}
        />
      ))}
      {value && !value.IdUbicacion && validCoordinates(value) && (
        <Marker
          coordinate={{ latitude: value.Latitud, longitude: value.Longitud }}
          title="Punto seleccionado"
          pinColor="#007b3e"
        />
      )}
    </MapView>
  );
}
