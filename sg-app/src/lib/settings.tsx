import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const WAKE_WORD_KEY = 'wakeWordOn';
const BACKGROUND_KEY = 'backgroundOn';

type SettingsValue = {
  wakeWordOn: boolean;
  setWakeWordOn: (on: boolean) => void;
  backgroundOn: boolean;
  setBackgroundOn: (on: boolean) => void;
};

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [wakeWordOn, setWakeWordState] = useState(true);
  const [backgroundOn, setBackgroundState] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([WAKE_WORD_KEY, BACKGROUND_KEY]).then(([[, wakeWord], [, background]]) => {
      if (wakeWord !== null) {
        setWakeWordState(wakeWord === 'true');
      }
      if (background !== null) {
        setBackgroundState(background === 'true');
      }
    });
  }, []);

  const setWakeWordOn = useCallback((on: boolean) => {
    setWakeWordState(on);
    AsyncStorage.setItem(WAKE_WORD_KEY, String(on));
  }, []);

  const setBackgroundOn = useCallback((on: boolean) => {
    setBackgroundState(on);
    AsyncStorage.setItem(BACKGROUND_KEY, String(on));
  }, []);

  return (
    <SettingsContext.Provider value={{ wakeWordOn, setWakeWordOn, backgroundOn, setBackgroundOn }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return value;
}
