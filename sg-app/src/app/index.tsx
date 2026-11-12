import { File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MicIcon, SendIcon, SettingsIcon } from '@/components/icons';
import { ListeningOverlay } from '@/components/listening-overlay';
import { MessageBubble, type Message } from '@/components/message-bubble';
import { StatusDot } from '@/components/status-dot';
import { colors, fonts } from '@/constants/theme';
import { useVoiceListener } from '@/hooks/use-voice-listener';
import { askLocationPermission } from '@/lib/location';
import { useServer, type JarvisReply } from '@/lib/server';
import { useSettings } from '@/lib/settings';
import { ENROLL_CLIPS } from '@/lib/voice-listener';

let nextId = 1;
const newId = () => String(nextId++);

const GREETING: Message = {
  id: 'greeting',
  role: 'jarvis',
  text: 'Hi! Say "Hey Jarvis", tap the mic, or type a request.',
};

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function matchNote(voiceMatch?: number) {
  return voiceMatch === undefined ? undefined : `Voice match ${voiceMatch.toFixed(2)}`;
}

async function saveWav(name: string, wav: Uint8Array) {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(wav);
  return file;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { status, checkServer, ask, askWithAudio, enrollVoice } = useServer();
  const { wakeWordOn, backgroundOn } = useSettings();
  const { enroll } = useLocalSearchParams<{ enroll?: string }>();
  const [enrollCount, setEnrollCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const canSend = draft.trim().length > 0 && !thinking;

  function addMessage(message: Omit<Message, 'id'>) {
    setMessages((old) => [...old, { ...message, id: newId() }]);
  }

  function setMessageText(id: string, text: string) {
    setMessages((old) => old.map((message) => (message.id === id ? { ...message, text } : message)));
  }

  async function getReply(request: () => Promise<JarvisReply>, voiceMessageId?: string) {
    setThinking(true);
    try {
      const reply = await request();
      if (voiceMessageId) {
        setMessageText(voiceMessageId, reply.heard || '(nothing heard)');
      }
      addMessage({ role: 'jarvis', text: reply.text, tools: reply.tools, note: matchNote(reply.voiceMatch) });
      listener.notify(`Jarvis: ${reply.text}`);
    } catch (error) {
      if (voiceMessageId) {
        setMessageText(voiceMessageId, 'Voice message');
      }
      addMessage({ role: 'error', text: errorText(error) });
    } finally {
      setThinking(false);
    }
  }

  async function sendText() {
    const text = draft.trim();
    if (!text || thinking) {
      return;
    }
    setDraft('');
    addMessage({ role: 'user', text });
    await getReply(() => ask(text));
  }

  async function sendVoice(wav: Uint8Array, wakeClip: Uint8Array | null) {
    const voiceFile = await saveWav('voice.wav', wav);
    const wakeFile = wakeClip ? await saveWav('wake.wav', wakeClip) : null;
    const id = newId();
    setMessages((old) => [...old, { id, role: 'user', text: 'Voice message…', voice: true }]);
    await getReply(() => askWithAudio(voiceFile.uri, wakeFile?.uri), id);
    voiceFile.delete();
    wakeFile?.delete();
  }

  async function saveVoiceProfile(clips: Uint8Array[]) {
    setThinking(true);
    const files = await Promise.all(clips.map((clip, index) => saveWav(`enroll${index}.wav`, clip)));
    try {
      const similarities = await enrollVoice(files.map((file) => file.uri));
      const matches = similarities.map((similarity) => similarity.toFixed(2)).join(', ');
      addMessage({ role: 'jarvis', text: `Got it, I know your voice now. Match of each try: ${matches}.` });
    } catch (error) {
      addMessage({ role: 'error', text: errorText(error) });
    } finally {
      files.forEach((file) => file.delete());
      setThinking(false);
    }
  }

  const listener = useVoiceListener({
    wakeWordOn,
    background: backgroundOn,
    paused: thinking,
    onCommand: sendVoice,
    onNothingHeard: () => addMessage({ role: 'jarvis', text: "I didn't hear anything." }),
    onEnrollProgress: setEnrollCount,
    onEnrollDone: saveVoiceProfile,
    onError: (message) => addMessage({ role: 'error', text: message }),
  });

  useEffect(() => {
    askLocationPermission();
  }, []);

  useEffect(() => {
    if (enroll === '1') {
      router.setParams({ enroll: '' });
      listener.startEnroll();
    }
  }, [enroll, listener]);

  function startListening() {
    Keyboard.dismiss();
    listener.startCommand();
  }

  const micHint =
    listener.mode !== 'wake'
      ? 'Tap to talk'
      : backgroundOn
        ? 'Listening for "Hey Jarvis", also in the background'
        : 'Listening for "Hey Jarvis", or tap to talk';

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Jarvis</Text>
          <Pressable accessibilityRole="button" accessibilityHint="Checks the server again" onPress={checkServer}>
            <StatusDot status={status} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={styles.iconButton}>
          <SettingsIcon color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {thinking && (
          <View style={styles.thinking}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.thinkingText}>Thinking…</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={sendText}
            placeholder="Type a request…"
            placeholderTextColor={colors.placeholder}
            returnKeyType="send"
            submitBehavior="submit"
            accessibilityLabel="Message Jarvis"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={sendText}
            style={[styles.sendButton, !canSend && styles.disabled]}>
            <SendIcon color={colors.onAccent} strokeWidth={2.5} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Talk to Jarvis"
          accessibilityState={{ disabled: thinking }}
          disabled={thinking}
          onPress={startListening}
          style={[styles.micButton, thinking && styles.disabled]}>
          <MicIcon color={colors.onAccent} size={30} />
        </Pressable>
        <Text style={styles.micHint}>{micHint}</Text>
      </View>

      {listener.mode === 'command' && (
        <ListeningOverlay onSend={listener.finishCommand} onCancel={listener.cancelCommand} />
      )}
      {listener.mode === 'enroll' && (
        <ListeningOverlay
          title="Say “Hey Jarvis”"
          detail={`${enrollCount} of ${ENROLL_CLIPS}`}
          hint="Say it 5 times in your normal voice, with a short pause each time"
          onCancel={listener.cancelEnroll}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerText: { gap: 4 },
  title: { fontFamily: fonts.heading, fontSize: 26, letterSpacing: 0.5, color: colors.text },
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
  messages: { flex: 1 },
  messagesContent: { padding: 20, gap: 14 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  thinkingText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  footer: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  inputRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  disabled: { opacity: 0.4 },
  micHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
});
