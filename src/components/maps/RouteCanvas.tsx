import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Text } from '../AppText';
import { CORDOBA } from './types';
import type { RouteCanvasProps } from './RouteCanvas.types';

export default function RouteCanvas({
  points,
  paths,
  selectedId,
  fitVersion,
  onSelect,
}: RouteCanvasProps) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const coordinates = [
      ...points.flatMap((point) =>
        point.coordinate ? [point.coordinate] : [],
      ),
      ...paths.flat(),
    ];
    if (coordinates.length > 1)
      map.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 48, bottom: 48, left: 48, right: 48 },
        animated: true,
      });
    else if (coordinates.length)
      map.current?.animateToRegion(
        { ...coordinates[0], latitudeDelta: 0.025, longitudeDelta: 0.025 },
        250,
      );
    else
      map.current?.animateToRegion(
        { ...CORDOBA, latitudeDelta: 0.09, longitudeDelta: 0.09 },
        250,
      );
  }, [ready, points, paths, fitVersion]);
  return (
    <View style={styles.frame}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        onMapReady={() => setReady(true)}
        initialRegion={{
          ...CORDOBA,
          latitudeDelta: 0.09,
          longitudeDelta: 0.09,
        }}
      >
        {paths.map((path, index) => (
          <Polyline
            key={index}
            coordinates={path}
            strokeColor="#007b3e"
            strokeWidth={5}
          />
        ))}
        {points.map(
          (point) =>
            point.coordinate && (
              <Marker
                key={point.stop.Id_Detalle_HDR}
                coordinate={point.coordinate}
                title={`Tarea ${point.number === 0 ? 'E' : point.number}: ${point.stop.Origen || 'Punto en mapa'}`}
                description={
                  point.number === 0 ? 'Salida y regreso' : point.stop.TipoMaterial || 'Tarea asignada'
                }
                onPress={() => onSelect(point.stop.Id_Detalle_HDR)}
              >
                <View
                  style={[
                    styles.pin,
                    point.stop.Id_Detalle_HDR === selectedId && styles.selected,
                  ]}
                >
                  <Text style={styles.number}>{point.number === 0 ? 'E' : point.number}</Text>
                </View>
              </Marker>
            ),
        )}
      </MapView>
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    height: 340,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#e6eee9',
  },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007b3e',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: '#0054a6' },
  number: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
