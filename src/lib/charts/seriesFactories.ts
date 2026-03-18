import type { LineSeriesOption } from 'echarts';

/**
 * Factory helpers that eliminate repetitive ECharts series definitions.
 * Each factory returns a fully-formed SeriesOption object.
 */

// ─── Anchor series ─────────────────────────────────────────────────────────────
// A silent, invisible line whose data drives the ECharts axis-pointer trigger.
// Without anchor data in each grid, custom-only grids would not fire tooltips.

export function makeAnchorSeries(
  name: string,
  xAxisIndex: number,
  yAxisIndex: number,
  data: [number, number][]
): LineSeriesOption {
  return {
    name,
    type: 'line',
    xAxisIndex,
    yAxisIndex,
    silent: true,
    symbol: 'none',
    lineStyle: { opacity: 0 },
    itemStyle: { opacity: 0 },
    data,
  };
}

// ─── Line series ───────────────────────────────────────────────────────────────
// Covers temperature, dewpoint, humidity, cloud base, and similar smooth lines.

export interface LineSerisDef {
  name: string;
  xAxisIndex: number;
  yAxisIndex: number;
  color: string;
  width?: number;
  lineType?: 'solid' | 'dashed';
  data: [number, number][];
  markArea?: LineSeriesOption['markArea'];
  z?: number;
  smooth?: boolean;
}

export function makeLineSeries(opts: LineSerisDef): LineSeriesOption {
  return {
    name: opts.name,
    type: 'line',
    xAxisIndex: opts.xAxisIndex,
    yAxisIndex: opts.yAxisIndex,
    smooth: opts.smooth ?? true,
    symbol: 'none',
    lineStyle: {
      color: opts.color,
      width: opts.width ?? 2,
      ...(opts.lineType ? { type: opts.lineType } : {}),
    },
    itemStyle: { color: opts.color },
    data: opts.data,
    ...(opts.markArea ? { markArea: opts.markArea } : {}),
    ...(opts.z != null ? { z: opts.z } : {}),
    tooltip: { show: false },
  };
}
