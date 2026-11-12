import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import BackgroundListening from '../../modules/background-listening';
import { VoiceListener, type ListenerMode } from '@/lib/voice-listener';

const LISTENING_TEXT = 'Listening for "Hey Jarvis"';

type Options = {
  wakeWordOn: boolean;
  background: boolean;
  paused: boolean;
  onCommand: (wav: Uint8Array, wakeClip: Uint8Array | null) => void;
  onNothingHeard: () => void;
  onEnrollProgress: (count: number) => void;
  onEnrollDone: (clips: Uint8Array[]) => void;
  onError: (message: string) => void;
};

export function useVoiceListener({ wakeWordOn, background, paused, ...handlerOptions }: Options) {
  const [mode, setMode] = useState<ListenerMode>('off');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const handlers = useRef(handlerOptions);
  const listenerRef = useRef<VoiceListener | null>(null);
  const keepListening = background && wakeWordOn && BackgroundListening !== null;

  useEffect(() => {
    handlers.current = handlerOptions;
  });

  useEffect(() => {
    const listener = new VoiceListener({
      onModeChange: setMode,
      onCommand: (wav, wakeClip) => handlers.current.onCommand(wav, wakeClip),
      onNothingHeard: () => handlers.current.onNothingHeard(),
      onEnrollProgress: (count) => handlers.current.onEnrollProgress(count),
      onEnrollDone: (clips) => handlers.current.onEnrollDone(clips),
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
    listenerRef.current?.setPaused(paused || (!appActive && !keepListening));
  }, [paused, appActive, keepListening]);

  useEffect(() => {
    if (!BackgroundListening) {
      return;
    }
    try {
      if (keepListening && appActive) {
        BackgroundListening.start(LISTENING_TEXT);
      } else if (!keepListening) {
        BackgroundListening.stop();
      }
    } catch (error) {
      handlers.current.onError(`Background listening could not start: ${error instanceof Error ? error.message : error}`);
    }
  }, [keepListening, appActive]);

  useEffect(() => () => {
    BackgroundListening?.stop();
  }, []);

  return {
    mode,
    startCommand: () => listenerRef.current?.startCommand(),
    finishCommand: () => listenerRef.current?.finishCommand(true),
    cancelCommand: () => listenerRef.current?.cancelCommand(),
    startEnroll: () => listenerRef.current?.startEnroll(),
    cancelEnroll: () => listenerRef.current?.cancelEnroll(),
    notify: (text: string) => {
      if (keepListening && AppState.currentState !== 'active') {
        BackgroundListening?.update(text);
      }
    },
  };
}
