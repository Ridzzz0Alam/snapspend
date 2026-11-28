/**
 * Gemini REST client (SPEC §5). Plain `fetch`, no SDK. Errors come back as typed results, never throws.
 * The API key goes in the `x-goog-api-key` header only (never in the URL) and is never logged
 * or included in an error message.
 */

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Current stable Gemini Flash model (checked 2026-11-28, DECISIONS D48). Editable in Settings. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/** Timeout for the Settings "Test key" request; receipt extraction uses SPEC §5's 60s. */
export const TEST_KEY_TIMEOUT_MS = 30_000;

export type GeminiErrorKind =
  | 'no_key'
  | 'bad_key'
  | 'bad_request'
  | 'model_not_found'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'timeout'
  | 'bad_response';

export interface GeminiError {
  kind: GeminiErrorKind;
  /** Friendly, user-facing message. */
  message: string;
  /** HTTP status, when the server answered. */
  status?: number;
  /** Raw message from the API or the runtime, for a "details" line. Never contains the key. */
  detail?: string;
}

export type GeminiResult<T> = { ok: true; value: T } | { ok: false; error: GeminiError };

/** The subset of `fetch` we use, so tests can inject a mock. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface GeminiRequestOptions {
  apiKey: string;
  model: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export function generateContentUrl(model: string): string {
  return `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;
}

const MAX_DETAIL = 300;

/** Pulls `error.message` / `error.status` / ErrorInfo reasons out of a Google API error body. */
function parseApiError(bodyText: string): { message?: string; status?: string; reasons: string[] } {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    const err = (parsed as { error?: unknown })?.error;
    if (!err || typeof err !== 'object') return { reasons: [] };
    const e = err as { message?: unknown; status?: unknown; details?: unknown };
    const reasons = Array.isArray(e.details)
      ? e.details
          .map((d) => (d as { reason?: unknown })?.reason)
          .filter((r): r is string => typeof r === 'string')
      : [];
    return {
      message: typeof e.message === 'string' ? e.message.slice(0, MAX_DETAIL) : undefined,
      status: typeof e.status === 'string' ? e.status : undefined,
      reasons,
    };
  } catch {
    return { reasons: [] };
  }
}

/** Maps a non-2xx Gemini response onto a typed, friendly error. */
export function classifyHttpError(status: number, bodyText: string, model: string): GeminiError {
  const api = parseApiError(bodyText);
  const detail = api.message;
  const keyProblem =
    api.reasons.some((r) => r.startsWith('API_KEY')) || /api key/i.test(api.message ?? '');

  if (status === 403 || (status === 400 && keyProblem) || status === 401) {
    return {
      kind: 'bad_key',
      status,
      detail,
      message: 'The Gemini API key was rejected. Check it in Settings.',
    };
  }
  if (status === 404) {
    return {
      kind: 'model_not_found',
      status,
      detail,
      message: `Gemini model "${model}" was not found. Check the model name in Settings.`,
    };
  }
  if (status === 429) {
    return {
      kind: 'rate_limited',
      status,
      detail,
      message: 'Gemini is busy or the free quota is used up. Try again in a minute.',
    };
  }
  if (status >= 500) {
    return {
      kind: 'server',
      status,
      detail,
      message: 'Gemini had a server problem. Try again shortly.',
    };
  }
  return {
    kind: 'bad_request',
    status,
    detail,
    message: `Gemini refused the request (HTTP ${status}).`,
  };
}

function redact(error: GeminiError, apiKey: string): GeminiError {
  if (!apiKey || !error.detail?.includes(apiKey)) return error;
  return { ...error, detail: error.detail.split(apiKey).join('[key]') };
}

/**
 * One POST to generateContent with a timeout. Returns the parsed JSON body on HTTP 2xx.
 * No retries here; callers that want SPEC §5's retry wrap this.
 */
export async function postGenerateContent(
  body: unknown,
  { apiKey, model, fetchImpl = fetch, timeoutMs = 60_000 }: GeminiRequestOptions,
): Promise<GeminiResult<unknown>> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetchImpl(generateContentUrl(model), {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      if (timedOut) {
        return {
          ok: false,
          error: { kind: 'timeout', message: 'Gemini took too long to answer. Try again.' },
        };
      }
      return {
        ok: false,
        error: redact(
          {
            kind: 'network',
            message: 'Could not reach Gemini. Check the internet connection.',
            detail: e instanceof Error ? e.message.slice(0, MAX_DETAIL) : undefined,
          },
          apiKey,
        ),
      };
    }

    const text = await response.text().catch(() => '');
    if (!response.ok) {
      return { ok: false, error: redact(classifyHttpError(response.status, text, model), apiKey) };
    }
    try {
      return { ok: true, value: JSON.parse(text) as unknown };
    } catch {
      return {
        ok: false,
        error: {
          kind: 'bad_response',
          status: response.status,
          message: 'Gemini sent a response the app could not read.',
        },
      };
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Settings → "Test key": a tiny text-only request. Any HTTP 2xx JSON answer means the key and
 * model work; the reply text itself doesn't matter.
 */
export async function testApiKey({
  apiKey,
  model,
  fetchImpl,
  timeoutMs = TEST_KEY_TIMEOUT_MS,
}: GeminiRequestOptions): Promise<GeminiResult<{ model: string }>> {
  const key = apiKey.trim();
  const modelName = model.trim() || DEFAULT_GEMINI_MODEL;
  if (!key) {
    return { ok: false, error: { kind: 'no_key', message: 'Enter a Gemini API key first.' } };
  }
  const result = await postGenerateContent(
    { contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }] }] },
    { apiKey: key, model: modelName, fetchImpl, timeoutMs },
  );
  return result.ok ? { ok: true, value: { model: modelName } } : result;
}
