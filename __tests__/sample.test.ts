import { add } from '@/lib/sample';

describe('jest setup', () => {
  it('resolves the @/ alias and runs a test', () => {
    expect(add(2, 3)).toBe(5);
  });
});
