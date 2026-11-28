import { DEFAULT_GEMINI_MODEL } from '@/lib/gemini';
import { cleanApiKey, maskApiKey, normalizeModelName } from '@/lib/settings';

describe('cleanApiKey', () => {
  it('removes whitespace and line breaks from a pasted key', () => {
    expect(cleanApiKey('  AIzaSyA-bc_123 \n')).toBe('AIzaSyA-bc_123');
    expect(cleanApiKey('AIza Sy\tA')).toBe('AIzaSyA');
  });

  it('returns an empty string for blank input', () => {
    expect(cleanApiKey('   ')).toBe('');
  });
});

describe('maskApiKey', () => {
  it('shows only the last 4 characters', () => {
    expect(maskApiKey('AIzaSyA1234567890abcd')).toBe('••••••••abcd');
  });

  it('never reveals a short key', () => {
    expect(maskApiKey('abcd')).toBe('••••••••');
    expect(maskApiKey('abcdefg')).toBe('••••••••');
  });

  it('returns an empty string for no key', () => {
    expect(maskApiKey('')).toBe('');
    expect(maskApiKey(null)).toBe('');
  });
});

describe('normalizeModelName', () => {
  it('trims and strips a "models/" prefix', () => {
    expect(normalizeModelName('  models/gemini-3.6-flash ')).toBe('gemini-3.6-flash');
    expect(normalizeModelName('gemini-3.8-flash')).toBe('gemini-3.8-flash');
  });

  it('falls back to the default model when blank', () => {
    expect(normalizeModelName('')).toBe(DEFAULT_GEMINI_MODEL);
    expect(normalizeModelName('  ')).toBe(DEFAULT_GEMINI_MODEL);
    expect(normalizeModelName(null)).toBe(DEFAULT_GEMINI_MODEL);
    expect(normalizeModelName('models/')).toBe(DEFAULT_GEMINI_MODEL);
  });
});
