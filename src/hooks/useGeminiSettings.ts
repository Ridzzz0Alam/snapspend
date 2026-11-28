/**
 * Gemini settings on the device: the API key in expo-secure-store (Android Keystore-backed),
 * the model name in expo-sqlite's key-value store (not secret). DECISIONS D49.
 * Development builds may also take the key from the local `.env` (D52); a key saved in
 * Settings always wins. The full key never goes into React state, only its masked form.
 */
import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useEffect, useState } from 'react';

import { testApiKey, type GeminiResult } from '@/lib/gemini';
import {
  cleanApiKey,
  maskApiKey,
  normalizeModelName,
  resolveApiKey,
  type ApiKeySource,
} from '@/lib/settings';

const API_KEY_KEY = 'gemini_api_key';
const MODEL_KEY = 'gemini_model';

/**
 * `.env` key for development builds. Written as a literal `process.env.EXPO_PUBLIC_…` so Expo can
 * inline it, and behind `__DEV__` so release builds drop it (verified, D52).
 */
const DEV_ENV_KEY: string | undefined = __DEV__
  ? process.env.EXPO_PUBLIC_GEMINI_API_KEY
  : undefined;

export interface GeminiConfig {
  apiKey: string | null;
  /** Where the key came from, or null when there is none. */
  keySource: ApiKeySource | null;
  model: string;
}

/** For non-UI callers (the scan flow): the key to use (or null), its source, and the model. */
export async function getGeminiConfig(): Promise<GeminiConfig> {
  const saved = await SecureStore.getItemAsync(API_KEY_KEY).catch(() => null);
  const { key, source } = resolveApiKey({ saved, envKey: DEV_ENV_KEY, isDev: __DEV__ });
  return {
    apiKey: key,
    keySource: source,
    model: normalizeModelName(Storage.getItemSync(MODEL_KEY)),
  };
}

export function useGeminiSettings() {
  const [loading, setLoading] = useState(true);
  const [maskedKey, setMaskedKey] = useState('');
  const [keySource, setKeySource] = useState<ApiKeySource | null>(null);
  const [model, setModel] = useState(() => normalizeModelName(null));

  const refresh = useCallback(async () => {
    const cfg = await getGeminiConfig();
    setMaskedKey(maskApiKey(cfg.apiKey));
    setKeySource(cfg.keySource);
    setModel(cfg.model);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getGeminiConfig()
      .then((cfg) => {
        if (cancelled) return;
        setMaskedKey(maskApiKey(cfg.apiKey));
        setKeySource(cfg.keySource);
        setModel(cfg.model);
      })
      .catch(() => {
        // Settings unreadable: behave as if nothing is saved.
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  /** Returns false (and saves nothing) when the input is blank. */
  const saveKey = useCallback(
    async (input: string): Promise<boolean> => {
      const key = cleanApiKey(input);
      if (!key) return false;
      await SecureStore.setItemAsync(API_KEY_KEY, key);
      await refresh();
      return true;
    },
    [refresh],
  );

  /** Removes the key saved in Settings (a dev build may then fall back to the `.env` key). */
  const removeKey = useCallback(async () => {
    await SecureStore.deleteItemAsync(API_KEY_KEY);
    await refresh();
  }, [refresh]);

  /** Saves the normalized name and returns it (blank → default model). */
  const saveModel = useCallback((input: string): string => {
    const name = normalizeModelName(input);
    Storage.setItemSync(MODEL_KEY, name);
    setModel(name);
    return name;
  }, []);

  const testKey = useCallback(async (): Promise<GeminiResult<{ model: string }>> => {
    const cfg = await getGeminiConfig();
    return testApiKey({ apiKey: cfg.apiKey ?? '', model: cfg.model });
  }, []);

  return {
    loading,
    hasKey: maskedKey !== '',
    maskedKey,
    keySource,
    model,
    saveKey,
    removeKey,
    saveModel,
    testKey,
  };
}
