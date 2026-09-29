/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { loadMaps } from './google-maps.web';
import { CORDOBA } from './types';
import type { RouteCanvasProps } from './RouteCanvas.types';

export default function RouteCanvas({
  points,
  paths,
  selectedId,
  fitVersion,
  onSelect,
}: RouteCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [error, setError] = useState('');
  const [markersAvailable, setMarkersAvailable] = useState(false);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    let disposed = false;
    let capability: google.maps.MapsEventListener | undefined;
    const authError = () =>
      setError(
        'Google Maps no está disponible. Revisá la clave y los permisos para localhost.',
      );
    window.addEventListener('sitmas-map-error', authError);
    void loadMaps()
      .then(() => {
        if (disposed || !container.current) return;
        const instance = new google.maps.Map(container.current, {
          center: { lat: CORDOBA.latitude, lng: CORDOBA.longitude },
          zoom: 12,
          mapId: 'DEMO_MAP_ID',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: 'cooperative',
        });
        const update = () => {
          if (!disposed)
            setMarkersAvailable(
              instance.getMapCapabilities().isAdvancedMarkersAvailable === true,
            );
        };
        capability = instance.addListener('mapcapabilities_changed', update);
        update();
        setMap(instance);
      })
      .catch(() => {
        if (!disposed)
          setError(
            'No se pudo cargar el mapa. Revisá la conexión y la configuración de Google Maps.',
          );
      });
    return () => {
      disposed = true;
      capability?.remove();
      window.removeEventListener('sitmas-map-error', authError);
    };
  }, []);
  useEffect(() => {
    if (!map || !markersAvailable || error) return;
    const listeners: (() => void)[] = [];
    const markers = points.flatMap((point) => {
      if (!point.coordinate) return [];
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: {
          lat: point.coordinate.latitude,
          lng: point.coordinate.longitude,
        },
        title: `Parada ${point.number}: ${point.stop.Origen || 'Punto en mapa'} · ${point.stop.HoraEstimadaFormateada || point.stop.HoraEstimada || 'Sin horario'}`,
        gmpClickable: true,
      });
      const badge = document.createElement('span');
      badge.textContent = String(point.number);
      badge.style.cssText =
        'display:grid;place-items:center;width:32px;height:32px;border-radius:50%;border:2px solid white;color:white;font:bold 14px sans-serif;box-shadow:0 2px 6px #0004;background:' +
        (point.stop.Id_Detalle_HDR === selectedId ? '#0054a6' : '#007b3e');
      marker.append(badge);
      const listener = () => select.current(point.stop.Id_Detalle_HDR);
      marker.addEventListener('gmp-click', listener);
      listeners.push(() => marker.removeEventListener('gmp-click', listener));
      return [marker];
    });
    return () => {
      listeners.forEach((remove) => remove());
      markers.forEach((marker) => {
        marker.map = null;
      });
    };
  }, [map, markersAvailable, points, selectedId, error]);
  useEffect(() => {
    if (!map || error) return;
    const lines = paths.map(
      (path) =>
        new google.maps.Polyline({
          map,
          path: path.map((point) => ({
            lat: point.latitude,
            lng: point.longitude,
          })),
          strokeColor: '#007b3e',
          strokeWeight: 5,
          strokeOpacity: 0.9,
        }),
    );
    return () => lines.forEach((line) => line.setMap(null));
  }, [map, paths, error]);
  useEffect(() => {
    if (!map || error) return;
    const coordinates = [
      ...points.flatMap((point) =>
        point.coordinate ? [point.coordinate] : [],
      ),
      ...paths.flat(),
    ];
    if (coordinates.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      coordinates.forEach((point) =>
        bounds.extend({ lat: point.latitude, lng: point.longitude }),
      );
      map.fitBounds(bounds, 45);
      // Las paradas repetidas en un mismo lugar tampoco deben llegar al zoom máximo.
      const idle = map.addListener('idle', () => {
        if ((map.getZoom() || 0) > 16) map.setZoom(16);
        idle.remove();
      });
      return () => idle.remove();
    }
    map.setCenter(
      coordinates.length
        ? { lat: coordinates[0].latitude, lng: coordinates[0].longitude }
        : { lat: CORDOBA.latitude, lng: CORDOBA.longitude },
    );
    map.setZoom(coordinates.length ? 15 : 12);
  }, [map, points, paths, fitVersion, error]);
  return (
    <View style={styles.frame}>
      <div
        ref={container}
        aria-label="Mapa del recorrido de la hoja de ruta"
        style={{
          height: '100%',
          width: '100%',
          visibility: error ? 'hidden' : 'visible',
        }}
      />
      {(!map || !!error) && (
        <View style={[StyleSheet.absoluteFill, styles.message]}>
          {error ? (
            <Text accessibilityRole="alert" style={styles.text}>
              {error}
            </Text>
          ) : (
            <>
              <ActivityIndicator />
              <Text style={styles.text}>Cargando mapa…</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    height: 340,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e6eee9',
  },
  message: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  text: { color: '#173542', textAlign: 'center' },
});
