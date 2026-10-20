import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const androidPackage = process.env.SITMAS_ANDROID_PACKAGE ?? config.android?.package;
  const lanPilot = process.env.SITMAS_LAN_PILOT === '1';
  if (lanPilot && process.env.EAS_BUILD_PROFILE === 'production') {
    throw new Error('El certificado del piloto LAN no se permite en producción.');
  }
  if (process.env.EAS_BUILD === 'true') {
    const api = process.env.EXPO_PUBLIC_SITMAS_API_URL;
    if (!api) throw new Error('Configurá EXPO_PUBLIC_SITMAS_API_URL en el entorno EAS.');
    const url = new URL(api);
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('La APK necesita una API HTTPS accesible desde el celular; no localhost.');
    }
    if (!androidPackage) throw new Error('Configurá SITMAS_ANDROID_PACKAGE con el identificador Android definitivo.');
    if (!androidKey) throw new Error('Configurá GOOGLE_MAPS_ANDROID_API_KEY para los mapas Android.');
  }
  return {
    ...config,
    name: 'SITMAS',
    slug: config.slug ?? 'my-app',
    android: {
      ...config.android,
      ...(androidPackage ? { package: androidPackage } : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      ...(lanPilot ? ['./plugins/with-lan-certificate.cjs'] : []),
      ...(androidKey
        ? [
            ['react-native-maps', { androidGoogleMapsApiKey: androidKey }] as [
              string,
              { androidGoogleMapsApiKey: string },
            ],
          ]
        : []),
    ],
  };
};
