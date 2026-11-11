import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MicIcon } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';

type Props = {
  onSend: () => void;
  onCancel: () => void;
};

function formatTime(millis: number) {
  const seconds = Math.floor(millis / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ListeningOverlay({ onSend, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - start), 250);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Jarvis</Text>
        <View style={styles.statusRow}>
          <View style={styles.recordingDot} />
          <Text style={styles.statusText}>Recording only while this screen is open</Text>
        </View>
      </View>

      <View style={styles.middle}>
        <View style={styles.rings}>
          <View style={[styles.ring, styles.outerRing]} />
          <View style={[styles.ring, styles.innerRing]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send what you said"
            onPress={onSend}
            style={styles.micButton}>
            <MicIcon color={colors.onAccent} size={44} />
          </Pressable>
        </View>
        <View style={styles.texts}>
          <Text style={styles.listening}>Listening…</Text>
          <Text style={styles.time}>{formatTime(elapsed)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.hint}>I send it when you stop talking, or tap the mic</Text>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  header: { gap: 4, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontFamily: fonts.heading, fontSize: 26, letterSpacing: 0.5, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.offline },
  statusText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 36 },
  rings: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.accent },
  outerRing: { width: 240, height: 240, borderRadius: 120, opacity: 0.15 },
  innerRing: { width: 172, height: 172, borderRadius: 86, opacity: 0.4 },
  micButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  texts: { alignItems: 'center', gap: 10 },
  listening: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  time: { fontFamily: fonts.medium, fontSize: 17, color: colors.textSoft },
  footer: { alignItems: 'center', gap: 14 },
  hint: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  cancelButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  cancelText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
