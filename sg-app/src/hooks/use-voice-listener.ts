import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { VoiceListener, type ListenerMode } from '@/lib/voice-listener';

type Options = {
  wakeWordOn: boolean;
  paused: boolean;
  onCommand: (wav: Uint8Array) => void;
  onNothingHeard: () => void;
  onError: (message: string) => void;
};

export function useVoiceListener({ wakeWordOn, paused, onCommand, onNothingHeard, onError }: Options) {
  const [mode, setMode] = useState<ListenerMode>('off');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const handlers = useRef({ onCommand, onNothingHeard, onError });
  const listenerRef = useRef<VoiceListener | null>(null);

  useEffect(() => {
    handlers.current = { onCommand, onNothingHeard, onError };
  });

  useEffect(() => {
    const listener = new VoiceListener({
      onModeChange: setMode,
      onCommand: (wav) => handlers.current.onCommand(wav),
      onNothingHeard: () => handlers.current.onNothingHeard(),
      onError: (message) => handlers.current.onError(message),
    });
    listenerRef.current = listener;
    return () => {
      listener.dispose();
      listenerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    listenerRef.current?.setWakeWord(wakeWordOn);
  }, [wakeWordOn]);

  useEffect(() => {
    listenerRef.current?.setPaused(paused || !appActive);
  }, [paused, appActive]);

  return {
    mode,
    startCommand: () => listenerRef.current?.startCommand(),
    finishCommand: () => listenerRef.current?.finishCommand(true),
    cancelCommand: () => listenerRef.current?.cancelCommand(),
  };
}
