import {
  useFonts,
  MavenPro_400Regular,
  MavenPro_500Medium,
  MavenPro_600SemiBold,
  MavenPro_700Bold,
  MavenPro_800ExtraBold,
  MavenPro_900Black,
} from '@expo-google-fonts/maven-pro';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../query/client';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    MavenPro_400Regular,
    MavenPro_500Medium,
    MavenPro_600SemiBold,
    MavenPro_700Bold,
    MavenPro_800ExtraBold,
    MavenPro_900Black,
  });
  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // TanStack refresca consultas vencidas cuando la app vuelve al primer plano.
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  if (!fontsLoaded && !fontError) return null;
  // El Provider hace accesible la misma caché a todos los hooks de TanStack.
  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </QueryClientProvider>
  );
}
