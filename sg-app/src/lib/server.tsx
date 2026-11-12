import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { currentPlace } from '@/lib/location';

export const DEFAULT_SERVER_URL = 'http://localhost:8000';
const STORAGE_KEY = 'serverUrl';
const HEALTH_TIMEOUT_MS = 4000;
const ANSWER_TIMEOUT_MS = 180000;

export type ServerStatus = 'checking' | 'online' | 'offline';
export type JarvisReply = { text: string; tools: string[]; heard?: string; voiceMatch?: number };

type ReplyJson = { text?: string; tools?: string[]; heard?: string | null; voice_match?: number | null };

type ServerContextValue = {
  serverUrl: string;
  setServerUrl: (url: string) => void;
  status: ServerStatus;
  checkServer: () => Promise<void>;
  ask: (text: string) => Promise<JarvisReply>;
  askWithAudio: (uri: string, wakeUri?: string | null) => Promise<JarvisReply>;
  enrollVoice: (uris: string[]) => Promise<number[]>;
};

const ServerContext = createContext<ServerContextValue | null>(null);

export function cleanUrl(url: string) {
  return url.trim().replace(/\/+$/, '');
}

async function fetchWithTimeout(url: string, timeoutMs: number, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getStatus(serverUrl: string): Promise<ServerStatus> {
  try {
    const response = await fetchWithTimeout(`${serverUrl}/health`, HEALTH_TIMEOUT_MS);
    return response.ok ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}

function wavFile(uri: string, name: string) {
  return { uri, name, type: 'audio/wav' } as unknown as Blob;
}

function toReply(data: ReplyJson): JarvisReply {
  return {
    text: data.text || 'Jarvis had no answer.',
    tools: data.tools ?? [],
    heard: data.heard ?? undefined,
    voiceMatch: data.voice_match ?? undefined,
  };
}

export function ServerProvider({ children }: { children: ReactNode }) {
  const [serverUrl, setServerUrlState] = useState(DEFAULT_SERVER_URL);
  const [status, setStatus] = useState<ServerStatus>('checking');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved) {
        setServerUrlState(saved);
      }
    });
  }, []);

  const setServerUrl = useCallback((url: string) => {
    const cleaned = cleanUrl(url);
    setStatus('checking');
    setServerUrlState(cleaned);
    AsyncStorage.setItem(STORAGE_KEY, cleaned);
  }, []);

  const checkServer = useCallback(async () => {
    setStatus('checking');
    setStatus(await getStatus(serverUrl));
  }, [serverUrl]);

  const post = useCallback(
    async <T,>(path: string, options: RequestInit): Promise<T> => {
      let response: Response;
      try {
        response = await fetchWithTimeout(`${serverUrl}${path}`, ANSWER_TIMEOUT_MS, { method: 'POST', ...options });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Jarvis took too long to answer.');
        }
        const status = await getStatus(serverUrl);
        setStatus(status);
        if (status === 'online') {
          throw new Error(`Sending to the server failed (${error instanceof Error ? error.message : error}). Try again.`);
        }
        throw new Error("Can't reach the server. Is it running, and did you run adb reverse tcp:8000 tcp:8000?");
      }
      setStatus('online');
      if (!response.ok) {
        throw new Error(`The server had a problem (error ${response.status}). Check its terminal.`);
      }
      return (await response.json()) as T;
    },
    [serverUrl],
  );

  const ask = useCallback(
    async (text: string) => {
      const place = await currentPlace();
      const data = await post<ReplyJson>('/process_text', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, ...place }),
      });
      return toReply(data);
    },
    [post],
  );

  const askWithAudio = useCallback(
    async (uri: string, wakeUri?: string | null) => {
      const form = new FormData();
      form.append('audio', wavFile(uri, 'voice.wav'));
      if (wakeUri) {
        form.append('wake', wavFile(wakeUri, 'wake.wav'));
      }
      const place = await currentPlace();
      if (place) {
        form.append('latitude', String(place.latitude));
        form.append('longitude', String(place.longitude));
        if (place.city) {
          form.append('city', place.city);
        }
      }
      return toReply(await post<ReplyJson>('/process_audio', { body: form }));
    },
    [post],
  );

  const enrollVoice = useCallback(
    async (uris: string[]) => {
      const form = new FormData();
      uris.forEach((uri, index) => form.append('clips', wavFile(uri, `clip${index}.wav`)));
      const data = await post<{ similarities: number[] }>('/enroll_voice', { body: form });
      return data.similarities;
    },
    [post],
  );

  useEffect(() => {
    let current = true;
    getStatus(serverUrl).then((result) => {
      if (current) {
        setStatus(result);
      }
    });
    return () => {
      current = false;
    };
  }, [serverUrl]);

  return (
    <ServerContext.Provider value={{ serverUrl, setServerUrl, status, checkServer, ask, askWithAudio, enrollVoice }}>
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const value = useContext(ServerContext);
  if (!value) {
    throw new Error('useServer must be used inside ServerProvider');
  }
  return value;
}
