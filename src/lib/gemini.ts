/**
 * Gemini REST client (SPEC §5). Plain `fetch`, no SDK. Errors come back as typed results, never throws.
 * The API key goes in the `x-goog-api-key` header only (never in the URL) and is never logged
 * or included in an error message.
 */

import { buildReceiptPrompt, RECEIPT_RESPONSE_SCHEMA } from './receiptPrompt';
import { validateReceipt, type GeminiReceipt } from './receiptSchema';

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Current stable Gemini Flash model (checked 2026-11-28, DECISIONS D48). Editable in Settings. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/** Timeout for the Settings "Test key" request. */
export const TEST_KEY_TIMEOUT_MS = 30_000;

/** Receipt extraction timeout (SPEC §5). */
export const RECEIPT_TIMEOUT_MS = 60_000;

/** Wait before the single automatic retry on 429 / 5xx (SPEC §5). */
export const RETRY_DELAY_MS = 2_000;

export type GeminiErrorKind =
  | 'no_key'
  | 'bad_key'
  | 'bad_request'
  | 'model_not_found'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'timeout'
  | 'bad_response'
  | 'blocked'
  | 'empty_response'
  | 'invalid_receipt';

export interface GeminiError {
  kind: GeminiErrorKind;
  /** Friendly, user-facing message. */
  message: string;
  /** HTTP status, when the server answered. */
  status?: number;
  /** Raw message from the API or the runtime, for a "details" line. Never contains the key. */
  detail?: string;
  /** invalid_receipt: what failed zod validation (`path: message`). */
  issues?: string[];
  /** invalid_receipt: the model's answer text, so the Review screen can offer a manual edit. */
  rawText?: string;
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

// ---- Receipt extraction (SPEC §5) ------------------------------------------------

export interface ExtractReceiptOptions extends GeminiRequestOptions {
  /** One base64 JPEG per page (already compressed), in page order. */
  images: readonly string[];
  /** Category list for the prompt; defaults to DEFAULT_CATEGORIES. */
  categories?: readonly string[];
  retryDelayMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface ExtractedReceipt {
  /** Validated (zod) receipt, before store aliases / category coercion (normalizeReceipt). */
  receipt: GeminiReceipt;
  /** The answer text exactly as received; stored as `rawGeminiJson`. */
  rawJson: string;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The generateContent body for a receipt: prompt + one inline JPEG per page, JSON output. */
export function buildReceiptRequest(images: readonly string[], categories?: readonly string[]) {
  return {
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildReceiptPrompt(categories) },
          ...images.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } })),
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: RECEIPT_RESPONSE_SCHEMA,
    },
  };
}

interface GenerateContentBody {
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
}

const BLOCKED_FINISH = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII']);

/** Pulls the answer text out of a generateContent body (thought parts skipped). */
export function answerText(body: unknown): GeminiResult<{ text: string; truncated: boolean }> {
  const b = (body ?? {}) as GenerateContentBody;
  const blockReason = b.promptFeedback?.blockReason;
  if (blockReason) {
    return {
      ok: false,
      error: {
        kind: 'blocked',
        detail: blockReason,
        message: 'Gemini refused to read this image.',
      },
    };
  }
  const candidate = b.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish && BLOCKED_FINISH.has(finish)) {
    return {
      ok: false,
      error: { kind: 'blocked', detail: finish, message: 'Gemini refused to read this image.' },
    };
  }
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  if (!text.trim()) {
    return {
      ok: false,
      error: {
        kind: 'empty_response',
        detail: finish,
        message: 'Gemini sent an empty answer. Try again.',
      },
    };
  }
  return { ok: true, value: { text, truncated: finish === 'MAX_TOKENS' } };
}

const RETRYABLE: ReadonlySet<GeminiErrorKind> = new Set(['rate_limited', 'server']);

/**
 * Reads a receipt: one request, one automatic retry on 429 / 5xx (after `retryDelayMs`), then the
 * answer is parsed and validated with zod. Network failures and timeouts are not retried (the
 * user can tap Retry). Never throws.
 */
export async function extractReceipt({
  apiKey,
  model,
  images,
  categories,
  fetchImpl,
  timeoutMs = RECEIPT_TIMEOUT_MS,
  retryDelayMs = RETRY_DELAY_MS,
  sleep = defaultSleep,
}: ExtractReceiptOptions): Promise<GeminiResult<ExtractedReceipt>> {
  const key = apiKey.trim();
  const modelName = model.trim() || DEFAULT_GEMINI_MODEL;
  if (!key) {
    return {
      ok: false,
      error: { kind: 'no_key', message: 'Add your Gemini API key in Settings first.' },
    };
  }
  if (images.length === 0) {
    return { ok: false, error: { kind: 'bad_request', message: 'No receipt image to read.' } };
  }

  const body = buildReceiptRequest(images, categories);
  const opts = { apiKey: key, model: modelName, fetchImpl, timeoutMs };
  let response = await postGenerateContent(body, opts);
  if (!response.ok && RETRYABLE.has(response.error.kind)) {
    await sleep(retryDelayMs);
    response = await postGenerateContent(body, opts);
  }
  if (!response.ok) return response;

  const answer = answerText(response.value);
  if (!answer.ok) return answer;
  const { text, truncated } = answer.value;

  const validated = validateReceipt(text);
  if (!validated.ok) {
    return {
      ok: false,
      error: {
        kind: 'invalid_receipt',
        message: truncated
          ? 'Gemini’s answer was cut off (receipt too long). Try again, or edit it by hand.'
          : `${validated.error} You can retry or edit it by hand.`,
        issues: validated.issues,
        rawText: text,
      },
    };
  }
  return { ok: true, value: { receipt: validated.data, rawJson: text } };
}
