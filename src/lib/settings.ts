/** Pure helpers for the Settings screen. Storage itself lives in src/hooks/useGeminiSettings.ts. */
import { DEFAULT_GEMINI_MODEL } from './gemini';

/** A pasted key often carries spaces or a line break; API keys never contain whitespace. */
export function cleanApiKey(input: string): string {
  return input.replace(/\s+/g, '');
}

const MASK = '••••••••';

/** `••••••••abcd`. Keys shorter than 8 characters are fully hidden. */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return '';
  return key.length < 8 ? MASK : MASK + key.slice(-4);
}

/** Trims, drops a pasted `models/` prefix, and falls back to the default model when blank. */
export function normalizeModelName(input: string | null | undefined): string {
  const name = (input ?? '').trim().replace(/^models\//, '');
  return name || DEFAULT_GEMINI_MODEL;
}

export type ApiKeySource = 'settings' | 'env';

/**
 * Which Gemini key to use (DECISIONS D52): the one saved in Settings wins; otherwise, in a
 * development build only, `EXPO_PUBLIC_GEMINI_API_KEY` from the local `.env`.
 */
export function resolveApiKey({
  saved,
  envKey,
  isDev,
}: {
  saved: string | null | undefined;
  envKey: string | null | undefined;
  isDev: boolean;
}): { key: string | null; source: ApiKeySource | null } {
  if (saved) return { key: saved, source: 'settings' };
  const fromEnv = isDev ? cleanApiKey(envKey ?? '') : '';
  return fromEnv ? { key: fromEnv, source: 'env' } : { key: null, source: null };
}
