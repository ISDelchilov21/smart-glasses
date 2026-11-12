import { router } from 'expo-router';
import { useState } from 'react';
import { PermissionsAndroid, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundListening from '../../modules/background-listening';
import { BackIcon, GlassesIcon, MicIcon, ShieldIcon } from '@/components/icons';
import { StatusDot } from '@/components/status-dot';
import { colors, fonts, monoFont } from '@/constants/theme';
import { cleanUrl, useServer } from '@/lib/server';
import { useSettings } from '@/lib/settings';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { serverUrl, setServerUrl, status, checkServer } = useServer();
  const { wakeWordOn, setWakeWordOn, backgroundOn, setBackgroundOn } = useSettings();
  const [address, setAddress] = useState(serverUrl);
  const backgroundAvailable = BackgroundListening !== null;

  async function changeBackground(on: boolean) {
    if (on) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    setBackgroundOn(on);
  }

  function testConnection() {
    if (cleanUrl(address) === serverUrl) {
      checkServer();
    } else {
      setServerUrl(address);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to chat"
          onPress={() => router.back()}
          style={styles.iconButton}>
          <BackIcon color={colors.text} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Server</Text>
          <View style={styles.card}>
            <Text style={styles.label} nativeID="server-label">
              Server address
            </Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              onSubmitEditing={testConnection}
              accessibilityLabelledBy="server-label"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://localhost:8000"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
            />
            <Text style={styles.helper}>
              Over USB, run <Text style={styles.code}>adb reverse tcp:8000 tcp:8000</Text> first. The address is saved on this phone.
            </Text>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" onPress={testConnection} style={styles.outlineButton}>
                <Text style={styles.outlineButtonText}>Test connection</Text>
              </Pressable>
              <StatusDot status={status} short />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wake word</Text>
          <View style={[styles.card, styles.cardRow, styles.centered]}>
            <MicIcon color={colors.accent} size={24} />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle} nativeID="wake-word-label">
                Listen for “Hey Jarvis”
              </Text>
              <Text style={styles.helper}>
                The sound is checked on this phone; nothing is sent until you say “Hey Jarvis”.
              </Text>
            </View>
            <Switch
              value={wakeWordOn}
              onValueChange={setWakeWordOn}
              accessibilityLabelledBy="wake-word-label"
              trackColor={{ false: colors.inputBorder, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>
          <View style={[styles.card, styles.cardRow, styles.centered]}>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle} nativeID="background-label">
                Keep listening in the background
              </Text>
              <Text style={styles.helper}>
                {backgroundAvailable
                  ? 'Also when Jarvis is closed. A notification shows that it is listening. Uses more battery.'
                  : 'Needs a new build of the app.'}
              </Text>
            </View>
            <Switch
              value={backgroundOn && backgroundAvailable}
              onValueChange={changeBackground}
              disabled={!backgroundAvailable || !wakeWordOn}
              accessibilityLabelledBy="background-label"
              trackColor={{ false: colors.inputBorder, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice check</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Only react to my voice</Text>
            <Text style={styles.helper}>
              Say “Hey Jarvis” 5 times. After that, Jarvis ignores other people who say it. Your voiceprint is saved
              on your laptop.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate('/?enroll=1')}
              style={[styles.outlineButton, styles.alignStart]}>
              <Text style={styles.outlineButtonText}>Teach Jarvis my voice</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety</Text>
          <View style={[styles.card, styles.cardRow]}>
            <ShieldIcon color={colors.accent} size={24} />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Calls and messages always ask you first</Text>
              <Text style={styles.helper}>Jarvis opens the dialer or the message. You press call or send.</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Glasses</Text>
          <View style={[styles.card, styles.cardRow, styles.centered]}>
            <GlassesIcon color={colors.text} size={26} />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Smart glasses</Text>
              <Text style={styles.helper}>Not connected yet</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              disabled
              style={[styles.smallButton, styles.disabled]}>
              <Text style={styles.smallButtonText}>Connect</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.version}>Jarvis app · version 0.1</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontFamily: fonts.heading, fontSize: 26, color: colors.text },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: { paddingHorizontal: 20, paddingTop: 24, gap: 28 },
  section: { gap: 10 },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  centered: { alignItems: 'center' },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.background,
    color: colors.text,
    fontFamily: monoFont,
    fontSize: 15,
  },
  helper: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted },
  code: { fontFamily: monoFont, color: colors.textSoft },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  outlineButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  outlineButtonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.accent },
  smallButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.background,
  },
  smallButtonText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  disabled: { opacity: 0.4 },
  alignStart: { alignSelf: 'flex-start' },
  version: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
});
