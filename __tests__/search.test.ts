import { foldForSearch, matchesSearch } from '@/lib/search';

describe('foldForSearch', () => {
  it('lowercases, strips accents and collapses spaces', () => {
    expect(foldForSearch('  TÚRÓ   RÖGÖS ')).toBe('turo rogos');
    expect(foldForSearch('GYŰRŰS FÁNK')).toBe('gyurus fank');
  });
});

describe('matchesSearch', () => {
  const fields = ['Chocolate donut', 'GYŰRŰS FÁNK CSOKI'];

  it.each([
    ['', true],
    ['   ', true],
    ['donut', true],
    ['DONUT', true],
    ['fank', true],
    ['fánk csoki', true],
    ['choc fank', true],
    ['donut milk', false],
    ['bread', false],
  ])('%p → %p', (q, expected) => {
    expect(matchesSearch(fields, q)).toBe(expected);
  });

  it('ignores null fields', () => {
    expect(matchesSearch(['Banana', null, undefined], 'banana')).toBe(true);
  });
});
