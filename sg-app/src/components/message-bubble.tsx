import { StyleSheet, Text, View } from 'react-native';

import { CheckIcon, MicIcon } from '@/components/icons';
import { colors, fonts, monoFont } from '@/constants/theme';

export type Message = {
  id: string;
  role: 'user' | 'jarvis' | 'error';
  text: string;
  tools?: string[];
  voice?: boolean;
  note?: string;
};

export function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <View style={[styles.bubble, styles.userBubble]}>
        {message.voice && <MicIcon color={colors.onAccent} size={16} />}
        <Text style={styles.userText}>{message.text}</Text>
      </View>
    );
  }

  const isError = message.role === 'error';
  return (
    <View style={styles.jarvisGroup}>
      <View style={[styles.bubble, styles.jarvisBubble, isError && styles.errorBubble]}>
        <Text style={[styles.jarvisText, isError && styles.errorText]}>{message.text}</Text>
      </View>
      {message.tools?.map((tool, index) => (
        <View key={`${tool}-${index}`} style={styles.toolRow}>
          <CheckIcon color={colors.textMuted} size={14} strokeWidth={2.5} />
          <Text style={styles.toolText}>
            Ran <Text style={styles.code}>{tool}</Text>
          </Text>
        </View>
      ))}
      {message.note && <Text style={[styles.toolText, styles.note]}>{message.note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18 },
  userBubble: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  userText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.onAccent },
  jarvisGroup: { alignSelf: 'flex-start', maxWidth: '82%', gap: 6 },
  jarvisBubble: {
    maxWidth: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  jarvisText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  errorBubble: { backgroundColor: colors.errorSurface, borderColor: colors.errorBorder },
  errorText: { color: colors.errorText },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 },
  toolText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  code: { fontFamily: monoFont },
  note: { paddingLeft: 4 },
});
