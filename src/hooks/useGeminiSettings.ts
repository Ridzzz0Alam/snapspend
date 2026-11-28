/**
 * Gemini settings on the device: the API key in expo-secure-store (Android Keystore-backed),
 * the model name in expo-sqlite's key-value store (not secret). DECISIONS D49.
 * The full key never goes into React state, only its masked form.
 */
import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useEffect, useState } from 'react';

import { testApiKey, type GeminiResult } from '@/lib/gemini';
import { cleanApiKey, maskApiKey, normalizeModelName } from '@/lib/settings';

const API_KEY_KEY = 'gemini_api_key';
const MODEL_KEY = 'gemini_model';

export interface GeminiConfig {
  apiKey: string | null;
  model: string;
}

/** For non-UI callers (the scan flow): the saved key (or null) and model. */
export async function getGeminiConfig(): Promise<GeminiConfig> {
  const apiKey = await SecureStore.getItemAsync(API_KEY_KEY);
  return { apiKey: apiKey || null, model: normalizeModelName(Storage.getItemSync(MODEL_KEY)) };
}

export function useGeminiSettings() {
  const [loading, setLoading] = useState(true);
  const [maskedKey, setMaskedKey] = useState('');
  const [model, setModel] = useState(() => normalizeModelName(null));

  useEffect(() => {
    let cancelled = false;
    getGeminiConfig()
      .then((cfg) => {
        if (cancelled) return;
        setMaskedKey(maskApiKey(cfg.apiKey));
        setModel(cfg.model);
      })
      .catch(() => {
        // Keystore unreadable (rare, e.g. after a restore): behave as if no key is saved.
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  /** Returns false (and saves nothing) when the input is blank. */
  const saveKey = useCallback(async (input: string): Promise<boolean> => {
    const key = cleanApiKey(input);
    if (!key) return false;
    await SecureStore.setItemAsync(API_KEY_KEY, key);
    setMaskedKey(maskApiKey(key));
    return true;
  }, []);

  const removeKey = useCallback(async () => {
    await SecureStore.deleteItemAsync(API_KEY_KEY);
    setMaskedKey('');
  }, []);

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
    model,
    saveKey,
    removeKey,
    saveModel,
    testKey,
  };
}
