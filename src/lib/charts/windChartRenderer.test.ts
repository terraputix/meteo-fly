import { describe, expect, it, vi } from 'vitest';
import { drawSmoothLine } from '#lib/charts/windChartRenderer.js';

describe('canvas curve drawing', () => {
  it('starts a new path after missing samples instead of bridging LCL or temperature gaps', () => {
    const ctx = { beginPath: vi.fn(), setLineDash: vi.fn(), moveTo: vi.fn(), bezierCurveTo: vi.fn(), stroke: vi.fn() };
    drawSmoothLine(
      ctx as unknown as CanvasRenderingContext2D,
      [
        [0, 10],
        [1, 20],
        [2, NaN],
        [3, 15],
        [4, 10],
      ],
      '#000'
    );
    expect(ctx.moveTo.mock.calls).toEqual([
      [0, 10],
      [3, 15],
    ]);
    expect(ctx.bezierCurveTo).toHaveBeenCalledTimes(2);
    expect(ctx.bezierCurveTo.mock.calls[0].slice(-2)).toEqual([1, 20]);
    expect(ctx.bezierCurveTo.mock.calls[1].slice(-2)).toEqual([4, 10]);
  });

  it('does not issue invalid coordinates for entirely missing data', () => {
    const ctx = { beginPath: vi.fn(), setLineDash: vi.fn(), moveTo: vi.fn(), bezierCurveTo: vi.fn(), stroke: vi.fn() };
    drawSmoothLine(
      ctx as unknown as CanvasRenderingContext2D,
      [
        [0, NaN],
        [1, Infinity],
      ],
      '#000'
    );
    expect(ctx.moveTo).not.toHaveBeenCalled();
    expect(ctx.bezierCurveTo).not.toHaveBeenCalled();
  });
});
