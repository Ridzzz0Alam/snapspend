import { FONT, fontForWeight } from '@/constants/fonts';

describe('fontForWeight', () => {
  it.each([
    [undefined, FONT.regular],
    ['normal', FONT.regular],
    ['300', FONT.regular],
    ['400', FONT.regular],
    ['500', FONT.medium],
    ['600', FONT.semibold],
    [600, FONT.semibold],
    ['700', FONT.bold],
    ['bold', FONT.bold],
    ['900', FONT.bold],
    ['ultralight', FONT.regular],
  ] as const)('%p → %s', (weight, family) => {
    expect(fontForWeight(weight)).toBe(family);
  });
});
