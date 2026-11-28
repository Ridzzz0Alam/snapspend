import { fitLongEdge, LONG_EDGE_PX, receiptPageName } from '@/lib/images';

describe('fitLongEdge', () => {
  it('scales the long edge down to 1600 px, keeping the aspect ratio', () => {
    expect(LONG_EDGE_PX).toBe(1600);
    expect(fitLongEdge(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitLongEdge(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it('rounds to whole pixels and never below 1', () => {
    expect(fitLongEdge(1000, 3333)).toEqual({ width: 480, height: 1600 });
    expect(fitLongEdge(1, 100000)).toEqual({ width: 1, height: 1600 });
  });

  it('returns null when the image is already small enough (no upscaling)', () => {
    expect(fitLongEdge(1600, 900)).toBeNull();
    expect(fitLongEdge(800, 1200)).toBeNull();
  });

  it('supports a custom limit', () => {
    expect(fitLongEdge(2000, 1000, 1000)).toEqual({ width: 1000, height: 500 });
  });
});

describe('receiptPageName', () => {
  it('numbers pages from 1', () => {
    expect(receiptPageName(0)).toBe('page-1.jpg');
    expect(receiptPageName(2)).toBe('page-3.jpg');
  });
});
