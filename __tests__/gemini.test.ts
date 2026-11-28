/**
 * @jest-environment node
 */
import {
  classifyHttpError,
  DEFAULT_GEMINI_MODEL,
  generateContentUrl,
  testApiKey,
  type FetchLike,
} from '@/lib/gemini';

const KEY = 'AIzaSyTEST-secret-key-1234';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const okBody = {
  candidates: [{ content: { role: 'model', parts: [{ text: 'OK' }] }, finishReason: 'STOP' }],
};

const badKeyBody = {
  error: {
    code: 400,
    message: 'API key not valid. Please pass a valid API key.',
    status: 'INVALID_ARGUMENT',
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }],
  },
};

describe('generateContentUrl', () => {
  it('builds the v1beta generateContent endpoint without the key', () => {
    expect(generateContentUrl('gemini-3.8-flash')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    );
  });

  it('escapes odd characters in the model name', () => {
    expect(generateContentUrl('a b/c')).toContain('/models/a%20b%2Fc:generateContent');
  });
});

describe('testApiKey', () => {
  it('sends a tiny text-only request with the key in a header, not the URL', async () => {
    const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () =>
      jsonResponse(200, okBody),
    );
    const result = await testApiKey({ apiKey: KEY, model: 'gemini-3.6-flash', fetchImpl });

    expect(result).toEqual({ ok: true, value: { model: 'gemini-3.6-flash' } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(generateContentUrl('gemini-3.6-flash'));
    expect(url).not.toContain(KEY);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'x-goog-api-key': KEY, 'Content-Type': 'application/json' });
    const body = JSON.parse(init.body as string);
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0].parts).toEqual([{ text: expect.any(String) }]);
  });

  it('uses the default model when none is given', async () => {
    const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () =>
      jsonResponse(200, okBody),
    );
    await testApiKey({ apiKey: KEY, model: '', fetchImpl });
    expect(fetchImpl.mock.calls[0]![0]).toBe(generateContentUrl(DEFAULT_GEMINI_MODEL));
  });

  it('fails without calling the API when there is no key', async () => {
    const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>();
    const result = await testApiKey({ apiKey: '  ', model: DEFAULT_GEMINI_MODEL, fetchImpl });
    expect(result).toMatchObject({ ok: false, error: { kind: 'no_key' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports an invalid key (400 API_KEY_INVALID) as bad_key', async () => {
    const result = await testApiKey({
      apiKey: KEY,
      model: DEFAULT_GEMINI_MODEL,
      fetchImpl: async () => jsonResponse(400, badKeyBody),
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'bad_key', status: 400 } });
  });

  it('reports an unknown model (404) as model_not_found', async () => {
    const result = await testApiKey({
      apiKey: KEY,
      model: 'gemini-nope',
      fetchImpl: async () =>
        jsonResponse(404, {
          error: { code: 404, message: 'models/gemini-nope is not found', status: 'NOT_FOUND' },
        }),
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'model_not_found', status: 404 } });
    if (!result.ok) expect(result.error.message).toContain('gemini-nope');
  });

  it('reports 429 as rate_limited', async () => {
    const result = await testApiKey({
      apiKey: KEY,
      model: DEFAULT_GEMINI_MODEL,
      fetchImpl: async () =>
        jsonResponse(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota' } }),
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'rate_limited', status: 429 } });
  });

  it('reports a network failure', async () => {
    const result = await testApiKey({
      apiKey: KEY,
      model: DEFAULT_GEMINI_MODEL,
      fetchImpl: async () => {
        throw new TypeError('Network request failed');
      },
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'network' } });
  });

  it('times out and aborts the request', async () => {
    let aborted = false;
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          aborted = true;
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        });
      });
    const result = await testApiKey({
      apiKey: KEY,
      model: DEFAULT_GEMINI_MODEL,
      fetchImpl,
      timeoutMs: 20,
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'timeout' } });
    expect(aborted).toBe(true);
  });

  it('reports a 200 that is not JSON as bad_response', async () => {
    const result = await testApiKey({
      apiKey: KEY,
      model: DEFAULT_GEMINI_MODEL,
      fetchImpl: async () => new Response('<html>proxy</html>', { status: 200 }),
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'bad_response' } });
  });

  it('never puts the API key in an error message', async () => {
    const echo = { error: { code: 400, message: `bad key ${KEY}`, status: 'INVALID_ARGUMENT' } };
    const result = await testApiKey({
      apiKey: KEY,
      model: DEFAULT_GEMINI_MODEL,
      fetchImpl: async () => jsonResponse(400, echo),
    });
    expect(JSON.stringify(result)).not.toContain(KEY);
  });
});

describe('classifyHttpError', () => {
  it.each([
    [400, badKeyBody, 'bad_key'],
    [403, { error: { code: 403, status: 'PERMISSION_DENIED', message: 'denied' } }, 'bad_key'],
    [
      400,
      { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'bad field' } },
      'bad_request',
    ],
    [404, { error: { code: 404, status: 'NOT_FOUND', message: 'x' } }, 'model_not_found'],
    [429, {}, 'rate_limited'],
    [500, {}, 'server'],
    [503, 'not json at all', 'server'],
    [418, {}, 'bad_request'],
  ] as const)('%i → %s', (status, body, kind) => {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    expect(classifyHttpError(status, text, 'gemini-3.8-flash').kind).toBe(kind);
  });

  it('keeps the API error message as detail', () => {
    expect(classifyHttpError(400, JSON.stringify(badKeyBody), 'm').detail).toBe(
      'API key not valid. Please pass a valid API key.',
    );
  });
});
