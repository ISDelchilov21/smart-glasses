import { Platform } from 'react-native';

export const colors = {
  background: '#0E1116',
  surface: '#171B22',
  border: '#262C36',
  divider: '#232934',
  inputBorder: '#2F3643',
  text: '#E8EAED',
  textMuted: '#9AA3AE',
  textSoft: '#C9CED6',
  placeholder: '#8A93A0',
  accent: '#4CC9F0',
  onAccent: '#0E1116',
  online: '#3DDC97',
  offline: '#F25F5C',
  checking: '#F4A259',
  errorSurface: '#2A1416',
  errorBorder: '#6B2C2E',
  errorText: '#F7C6C4',
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  heading: 'SpaceGrotesk_700Bold',
};

export const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });
