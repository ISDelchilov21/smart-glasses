import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { colors } from '@/constants/theme';
import { ServerProvider } from '@/lib/server';
import { SettingsProvider } from '@/lib/settings';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.divider,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SettingsProvider>
      <ServerProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        </ThemeProvider>
      </ServerProvider>
    </SettingsProvider>
  );
}
