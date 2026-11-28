/**
 * @jest-environment node
 */
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import {
  extractReceipt,
  generateContentUrl,
  RECEIPT_TIMEOUT_MS,
  type ExtractReceiptOptions,
  type FetchLike,
} from '@/lib/gemini';
import { buildReceiptPrompt, RECEIPT_RESPONSE_SCHEMA } from '@/lib/receiptPrompt';

import { validScanned } from './fixtures/gemini';

const KEY = 'AIzaSyTEST-secret-key-1234';
const IMG1 = 'BASE64PAGEONE';
const IMG2 = 'BASE64PAGETWO';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A generateContent 200 whose answer text is `text`. */
function answer(text: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse(200, {
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP', ...extra }],
  });
}

const apiError = (code: number, status: string, message = 'x') =>
  jsonResponse(code, { error: { code, status, message } });

type MockFetch = jest.Mock<ReturnType<FetchLike>, Parameters<FetchLike>>;

/** A fetch mock that returns the given responses in order. */
function fetchSequence(...responses: (() => Response | Promise<Response>)[]): MockFetch {
  const mock: MockFetch = jest.fn();
  for (const r of responses) mock.mockImplementationOnce(async () => r());
  return mock;
}

const sleep = jest.fn(async (_ms: number) => {});

function run(fetchImpl: FetchLike, over: Partial<ExtractReceiptOptions> = {}) {
  return extractReceipt({
    apiKey: KEY,
    model: 'gemini-3.8-flash',
    images: [IMG1],
    fetchImpl,
    sleep,
    ...over,
  });
}

beforeEach(() => sleep.mockClear());

describe('extractReceipt — request', () => {
  it('sends the SPEC §5 request: prompt + one inline JPEG per page, JSON schema, temperature 0.1', async () => {
    const fetchImpl = fetchSequence(() => answer(JSON.stringify(validScanned)));
    await run(fetchImpl, { images: [IMG1, IMG2], categories: ['Bakery', 'Other'] });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(generateContentUrl('gemini-3.8-flash'));
    expect(init.headers).toEqual({ 'x-goog-api-key': KEY, 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildReceiptPrompt(['Bakery', 'Other']) },
            { inline_data: { mime_type: 'image/jpeg', data: IMG1 } },
            { inline_data: { mime_type: 'image/jpeg', data: IMG2 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: RECEIPT_RESPONSE_SCHEMA,
      },
    });
  });

  it('uses the default categories when none are given', async () => {
    const fetchImpl = fetchSequence(() => answer(JSON.stringify(validScanned)));
    await run(fetchImpl);
    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(body.contents[0].parts[0].text).toBe(buildReceiptPrompt(DEFAULT_CATEGORIES));
  });

  it('refuses without calling the API when there is no key or no image', async () => {
    const fetchImpl: MockFetch = jest.fn();
    expect(await run(fetchImpl, { apiKey: ' ' })).toMatchObject({
      ok: false,
      error: { kind: 'no_key' },
    });
    expect(await run(fetchImpl, { images: [] })).toMatchObject({
      ok: false,
      error: { kind: 'bad_request' },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('defaults to the 60 s timeout from SPEC §5', () => {
    expect(RECEIPT_TIMEOUT_MS).toBe(60_000);
  });
});

describe('extractReceipt — success', () => {
  it('returns the validated receipt and the raw JSON text', async () => {
    const raw = JSON.stringify(validScanned);
    const result = await run(fetchSequence(() => answer(raw)));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.rawJson).toBe(raw);
    expect(result.value.receipt).toMatchObject({
      store: 'INTERSPAR',
      cardLast4: '4821',
      printedTotal: 1070,
    });
    expect(result.value.receipt.items).toHaveLength(3);
  });

  it('ignores thought parts and joins split text parts', async () => {
    const raw = JSON.stringify(validScanned);
    const half = Math.floor(raw.length / 2);
    const response = jsonResponse(200, {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              { text: 'Let me read the receipt…', thought: true },
              { text: raw.slice(0, half) },
              { text: raw.slice(half) },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    });
    const result = await run(fetchSequence(() => response));
    expect(result.ok).toBe(true);
  });
});

describe('extractReceipt — bad answers (no retry, keep raw text for manual edit)', () => {
  it('malformed JSON → invalid_receipt with the raw text', async () => {
    const fetchImpl = fetchSequence(() => answer('{"store": "SPAR", "items": [ oops'));
    const result = await run(fetchImpl);
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'invalid_receipt', rawText: '{"store": "SPAR", "items": [ oops' },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('JSON that breaks the schema → invalid_receipt with the issues', async () => {
    const bad = { ...validScanned, printedTotal: 10.5, date: '2026-13-40' };
    const result = await run(fetchSequence(() => answer(JSON.stringify(bad))));
    if (result.ok) throw new Error('expected failure');
    expect(result.error.kind).toBe('invalid_receipt');
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^printedTotal:/),
        expect.stringMatching(/^date:/),
      ]),
    );
    expect(result.error.rawText).toBe(JSON.stringify(bad));
  });

  it('a blocked prompt → blocked', async () => {
    const response = jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } });
    expect(await run(fetchSequence(() => response))).toMatchObject({
      ok: false,
      error: { kind: 'blocked', detail: 'SAFETY' },
    });
  });

  it('a candidate stopped for safety → blocked', async () => {
    const response = jsonResponse(200, {
      candidates: [{ content: { role: 'model', parts: [] }, finishReason: 'SAFETY' }],
    });
    expect(await run(fetchSequence(() => response))).toMatchObject({
      ok: false,
      error: { kind: 'blocked' },
    });
  });

  it('no text at all → empty_response', async () => {
    const response = jsonResponse(200, { candidates: [{ finishReason: 'STOP' }] });
    expect(await run(fetchSequence(() => response))).toMatchObject({
      ok: false,
      error: { kind: 'empty_response' },
    });
  });

  it('cut off by the token limit → invalid_receipt mentioning truncation', async () => {
    const response = answer('{"kind":"scanned","store":"SP', { finishReason: 'MAX_TOKENS' });
    const result = await run(fetchSequence(() => response));
    if (result.ok) throw new Error('expected failure');
    expect(result.error.kind).toBe('invalid_receipt');
    expect(result.error.message).toMatch(/cut off/i);
  });
});

describe('extractReceipt — HTTP errors and retry', () => {
  const ok = () => answer(JSON.stringify(validScanned));

  it('400 bad key → bad_key, no retry', async () => {
    const fetchImpl = fetchSequence(() =>
      jsonResponse(400, {
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: 'API key not valid.',
          details: [{ reason: 'API_KEY_INVALID' }],
        },
      }),
    );
    expect(await run(fetchImpl)).toMatchObject({ ok: false, error: { kind: 'bad_key' } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('429 then success → retries once after a backoff', async () => {
    const fetchImpl = fetchSequence(() => apiError(429, 'RESOURCE_EXHAUSTED'), ok);
    const result = await run(fetchImpl);
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0]![0]).toBeGreaterThan(0);
  });

  it('429 twice → rate_limited after one retry', async () => {
    const fetchImpl = fetchSequence(
      () => apiError(429, 'RESOURCE_EXHAUSTED'),
      () => apiError(429, 'RESOURCE_EXHAUSTED'),
    );
    expect(await run(fetchImpl)).toMatchObject({ ok: false, error: { kind: 'rate_limited' } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('503 then success → retries once', async () => {
    const fetchImpl = fetchSequence(() => apiError(503, 'UNAVAILABLE', 'high demand'), ok);
    expect((await run(fetchImpl)).ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('500 twice → server', async () => {
    const fetchImpl = fetchSequence(
      () => apiError(500, 'INTERNAL'),
      () => apiError(500, 'INTERNAL'),
    );
    expect(await run(fetchImpl)).toMatchObject({ ok: false, error: { kind: 'server' } });
  });

  it('network failure → network, no retry', async () => {
    const fetchImpl: MockFetch = jest.fn();
    fetchImpl.mockRejectedValue(new TypeError('Network request failed'));
    expect(await run(fetchImpl)).toMatchObject({ ok: false, error: { kind: 'network' } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('timeout → timeout, no retry', async () => {
    const fetchImpl: MockFetch = jest.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
          );
        }),
    );
    expect(await run(fetchImpl, { timeoutMs: 20 })).toMatchObject({
      ok: false,
      error: { kind: 'timeout' },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('never puts the API key in an error', async () => {
    const fetchImpl = fetchSequence(
      () => apiError(500, 'INTERNAL', `boom ${KEY}`),
      () => apiError(500, 'INTERNAL', `boom ${KEY}`),
    );
    expect(JSON.stringify(await run(fetchImpl))).not.toContain(KEY);
  });
});
