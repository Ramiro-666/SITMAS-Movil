/// <reference types="google.maps" />
import { Text } from '../AppText';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { CORDOBA, validCoordinates, type MapCanvasProps } from './types';

import { loadMaps } from './google-maps.web';

export default function MapCanvas({
  locations,
  value,
  disabled,
  onChange,
}: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [error, setError] = useState('');
  const [markersAvailable, setMarkersAvailable] = useState(false);
  const callback = useRef({ onChange, disabled });
  useEffect(() => {
    callback.current = { onChange, disabled };
  }, [onChange, disabled]);
  useEffect(() => {
    let disposed = false;
    let click: google.maps.MapsEventListener | undefined;
    let capabilities: google.maps.MapsEventListener | undefined;
    const authError = () =>
      setError(
        'Google Maps no está disponible para esta aplicación. Podés elegir una ubicación guardada.',
      );
    window.addEventListener('sitmas-map-error', authError);
    void loadMaps()
      .then(() => {
        if (disposed || !container.current) return;
        const instance = new google.maps.Map(container.current, {
          center: { lat: CORDOBA.latitude, lng: CORDOBA.longitude },
          zoom: 13,
          mapId: 'DEMO_MAP_ID',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        click = instance.addListener(
          'click',
          (event: google.maps.MapMouseEvent) => {
            if (!callback.current.disabled && event.latLng)
              callback.current.onChange({
                Latitud: event.latLng.lat(),
                Longitud: event.latLng.lng(),
                Descripcion: '',
              });
          },
        );
        capabilities = instance.addListener('mapcapabilities_changed', () => {
          if (!disposed)
            setMarkersAvailable(
              instance.getMapCapabilities().isAdvancedMarkersAvailable === true,
            );
        });
        setMarkersAvailable(
          instance.getMapCapabilities().isAdvancedMarkersAvailable === true,
        );
        setMap(instance);
      })
      .catch((reason: Error) => {
        if (!disposed) setError(reason.message);
      });
    return () => {
      disposed = true;
      click?.remove();
      capabilities?.remove();
      window.removeEventListener('sitmas-map-error', authError);
    };
  }, []);
  useEffect(() => {
    if (!map || !markersAvailable || error) return;
    const listeners: (() => void)[] = [];
    const points = locations.filter(validCoordinates);
    const markers = points.map((location) => {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: location.Latitud, lng: location.Longitud },
        title: location.Descripcion,
        gmpClickable: true,
      });
      const select = () => {
        if (!callback.current.disabled) callback.current.onChange(location);
      };
      marker.addEventListener('gmp-click', select);
      listeners.push(() => marker.removeEventListener('gmp-click', select));
      return marker;
    });
    if (value && validCoordinates(value)) {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: value.Latitud, lng: value.Longitud },
        title: 'Punto seleccionado',
        zIndex: 1000,
      });
      marker.append(
        new google.maps.marker.PinElement({
          background: '#007b3e',
          borderColor: '#005b2e',
          glyphColor: '#fff',
        }),
      );
      markers.push(marker);
    }
    return () => {
      listeners.forEach((remove) => remove());
      markers.forEach((marker) => {
        marker.map = null;
      });
    };
  }, [map, markersAvailable, error, locations, value]);
  const latitude = value?.Latitud;
  const longitude = value?.Longitud;
  useEffect(() => {
    if (map && latitude !== undefined && longitude !== undefined)
      map.panTo({ lat: latitude, lng: longitude });
  }, [map, latitude, longitude]);
  return (
    <View>
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: '#b23030', paddingVertical: 8 }}
        >
          {error}
        </Text>
      )}
      {!map && !error && (
        <ActivityIndicator accessibilityLabel="Cargando mapa" />
      )}
      <div
        ref={container}
        aria-label="Mapa de ubicaciones"
        style={{
          width: '100%',
          height: 300,
          borderRadius: 8,
          overflow: 'hidden',
          display: error ? 'none' : 'block',
        }}
      />
    </View>
  );
}
