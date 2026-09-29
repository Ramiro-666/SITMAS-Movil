import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  return {
    ...config,
    name: config.name ?? 'my-app',
    slug: config.slug ?? 'my-app',
    plugins: [
      ...(config.plugins ?? []),
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
