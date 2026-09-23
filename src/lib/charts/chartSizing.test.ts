import { describe, expect, it } from 'vitest';
import { getSkewTChartSize, getWindChartSize, SKEWT_MIN_HEIGHT } from '$lib/charts/chartSizing';
import { getChartHeight, getWindChartHeight, MARGIN_LEFT, MARGIN_RIGHT } from '$lib/charts/buildWindChartOption';
import { MAX_ALTITUDE_OPTIONS } from '$lib/meteo/types';
import { SKEWT_MARGIN } from '$lib/charts/skewTRenderer';

describe('wind chart sizing', () => {
  it('uses a 2:1 altitude plot at the reference elevation when space permits', () => {
    const size = getWindChartSize(1100, 1000, 4000);
    expect((size.width - MARGIN_LEFT - MARGIN_RIGHT) / (size.height - getChartHeight(0))).toBe(2);
  });

  it('stops growing on ultrawide and tall panels', () => {
    expect(getWindChartSize(2500, 2000, 4000)).toEqual(getWindChartSize(960, 1000, 4000));
  });

  it('caps desktop width at 960px', () => {
    expect(getWindChartSize(2500, 2000, 4000).width).toBe(960);
  });

  it('adds 10% height at high elevations on wide panels', () => {
    const low = getWindChartSize(960, 2000, 4000);
    const high = getWindChartSize(960, 2000, 8000);
    expect(high.height - getChartHeight(0)).toBeCloseTo(2.2 * (low.height - getChartHeight(0)));
  });

  it('preserves the extra high-elevation height in short wide panels', () => {
    const size = getWindChartSize(960, 500, 10000);
    expect(size.height).toBe(getChartHeight(Math.ceil(getWindChartHeight(10000) * 1.1)));
    expect(getWindChartSize(960, 0, 10000).height).toBe(size.height);
  });

  it('increases height smoothly as panels widen', () => {
    const narrow = getWindChartSize(720, 500, 8000);
    const medium = getWindChartSize(840, 500, 8000);
    const wide = getWindChartSize(960, 500, 8000);
    expect(narrow.height).toBe(getChartHeight(getWindChartHeight(8000)));
    expect(medium.height).toBeGreaterThan(narrow.height);
    expect(medium.height).toBeLessThan(wide.height);
  });

  it('grows at every top elevation even when the panel is short', () => {
    const heights = MAX_ALTITUDE_OPTIONS.map(({ value }) => getWindChartSize(960, 500, value).height);
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }
    expect(getWindChartHeight(10000)).toBeGreaterThanOrEqual(getWindChartHeight(4000) * 2.5);
  });

  it('limits growth by available height', () => {
    const height = getChartHeight(getWindChartHeight(4000)) + 30;
    expect(getWindChartSize(1200, height, 4000).height).toBe(height);
  });

  it('keeps the altitude-dependent minimum on narrow or short panels', () => {
    const size = getWindChartSize(340, 300, 10000);
    expect(size.width).toBe(340);
    expect(size.height).toBe(getChartHeight(getWindChartHeight(10000)));
  });
});

describe('Skew-T sizing', () => {
  it.each([
    [800, 1000],
    [1200, 650],
    [2500, 2000],
  ])('keeps the plot square at %i × %i', (width, height) => {
    const size = getSkewTChartSize(width, height);
    expect(size.width - SKEWT_MARGIN.left - SKEWT_MARGIN.right).toBe(
      size.height - SKEWT_MARGIN.top - SKEWT_MARGIN.bottom
    );
    expect(size.width).toBeLessThanOrEqual(Math.min(width, 850));
    expect(size.height).toBeLessThanOrEqual(height);
  });

  it('caps size even with extra space in both dimensions', () => {
    expect(getSkewTChartSize(2500, 2000)).toEqual({ width: 850, height: 800 });
  });

  it('preserves readable height without horizontal overflow on mobile', () => {
    expect(getSkewTChartSize(340, 300)).toEqual({ width: 340, height: SKEWT_MIN_HEIGHT });
  });

  it('shrinks again after the panel becomes shorter', () => {
    expect(getSkewTChartSize(1000, 600)).toEqual({ width: 650, height: 600 });
  });
});
