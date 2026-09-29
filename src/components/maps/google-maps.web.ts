/// <reference types="google.maps" />
declare global {
  interface Window {
    sitmasMapsReady?: () => void;
    gm_authFailure?: () => void;
    sitmasMapsLoading?: Promise<void>;
  }
}
export function loadMaps() {
  // También reutilizar la carga durante Fast Refresh de Expo.
  if (
    typeof google !== 'undefined' &&
    google.maps?.Map &&
    google.maps.marker?.AdvancedMarkerElement
  )
    return Promise.resolve();
  if (window.sitmasMapsLoading) return window.sitmasMapsLoading;
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;
  if (!key)
    return Promise.reject(
      new Error('Mapa no disponible. Podés elegir una ubicación guardada.'),
    );
  window.sitmasMapsLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => fail(), 20000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      window.sitmasMapsLoading = undefined;
      delete window.sitmasMapsReady;
      reject(
        new Error(
          'No se pudo cargar el mapa. Podés elegir una ubicación guardada.',
        ),
      );
    }
    window.sitmasMapsReady = () => {
      window.clearTimeout(timeout);
      delete window.sitmasMapsReady;
      resolve();
    };
    window.gm_authFailure = () =>
      window.dispatchEvent(new Event('sitmas-map-error'));
    script.src =
      'https://maps.googleapis.com/maps/api/js?' +
      new URLSearchParams({
        key,
        callback: 'sitmasMapsReady',
        loading: 'async',
        libraries: 'marker',
        v: 'weekly',
        language: 'es',
        region: 'AR',
      });
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return window.sitmasMapsLoading;
}
