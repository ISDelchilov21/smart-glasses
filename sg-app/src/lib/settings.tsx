import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const WAKE_WORD_KEY = 'wakeWordOn';

type SettingsValue = {
  wakeWordOn: boolean;
  setWakeWordOn: (on: boolean) => void;
};

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [wakeWordOn, setWakeWordState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(WAKE_WORD_KEY).then((saved) => {
      if (saved !== null) {
        setWakeWordState(saved === 'true');
      }
    });
  }, []);

  const setWakeWordOn = useCallback((on: boolean) => {
    setWakeWordState(on);
    AsyncStorage.setItem(WAKE_WORD_KEY, String(on));
  }, []);

  return <SettingsContext.Provider value={{ wakeWordOn, setWakeWordOn }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return value;
}
