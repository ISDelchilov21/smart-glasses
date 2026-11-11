import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import type { ServerStatus } from '@/lib/server';

const LOOK: Record<ServerStatus, { color: string; long: string; short: string }> = {
  checking: { color: colors.checking, long: 'Checking server…', short: 'Checking…' },
  online: { color: colors.online, long: 'Connected to server', short: 'Connected' },
  offline: { color: colors.offline, long: 'Server offline', short: 'Offline' },
};

export function StatusDot({ status, short = false }: { status: ServerStatus; short?: boolean }) {
  const look = LOOK[status];
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: look.color }]} />
      <Text style={short ? styles.shortText : styles.longText}>{short ? look.short : look.long}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  longText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  shortText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
});
