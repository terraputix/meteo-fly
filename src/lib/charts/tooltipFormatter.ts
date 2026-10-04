import type { TemperatureChartData, RainCloudChartData } from '#lib/workers/chartWorker.types.js';
import type { WindFieldLevel } from '#lib/charts/wind.js';
import { windColorScale } from '#lib/charts/scales.js';
import { CHART_COLORS } from '#lib/charts/chartColors.js';
import { fmtTime } from '#lib/helpers.js';
import type { LclPoint } from '#lib/meteo/lcl.js';

// ─── Tooltip store ──────────────────────────────────────────────────────────
// Pre-built look-up maps keyed by timestamp so the formatter is O(1).

export interface TooltipStore {
  sortedTimes: number[];
  tempByTime: Map<number, { temp: number; dew: number; hum: number }>;
  rainByTime: Map<number, number>;
  cloudLowByTime: Map<number, number>;
  cloudMidByTime: Map<number, number>;
  cloudHighByTime: Map<number, number>;
  lclByTime: Map<number, number>;
  windByTimePressure: Map<string, { height: number; speed: number; direction: number }>;
  sortedWindPressures: number[];
}

export function buildTooltipStore(
  tempData: TemperatureChartData,
  rainData: RainCloudChartData,
  windData: WindFieldLevel[],
  cloudBase: LclPoint[]
): TooltipStore {
  const tempByTime = new Map<number, { temp: number; dew: number; hum: number }>();
  tempData.temperatureData.forEach((d, i) => {
    tempByTime.set(d.time.getTime(), {
      temp: d.value,
      dew: tempData.dewpointData[i].value,
      hum: tempData.humidityData[i].value,
    });
  });

  const rainByTime = new Map<number, number>();
  rainData.rainDots.forEach((d) => rainByTime.set(d.time.getTime(), d.rain));

  const cloudLowByTime = new Map<number, number>();
  const cloudMidByTime = new Map<number, number>();
  const cloudHighByTime = new Map<number, number>();
  rainData.cloudRects.forEach((r) => {
    const mid = (r.x1.getTime() + r.x2.getTime()) / 2;
    if (r.y1 < 0.01) cloudLowByTime.set(mid, r.cloudCover);
    else if (r.y1 < 0.4) cloudMidByTime.set(mid, r.cloudCover);
    else cloudHighByTime.set(mid, r.cloudCover);
  });

  const lclByTime = new Map<number, number>();
  cloudBase.forEach((d) => {
    if (d.value != null && Number.isFinite(d.value)) lclByTime.set(d.time.getTime(), d.value);
  });

  const windByTimePressure = new Map<string, { height: number; speed: number; direction: number }>();
  const windPressuresSet = new Set<number>();
  windData.forEach((w) => {
    const t = w.time.getTime();
    windByTimePressure.set(`${t}_${w.pressure}`, {
      height: w.height,
      speed: w.speed,
      direction: w.direction,
    });
    windPressuresSet.add(w.pressure);
  });

  return {
    sortedTimes: Array.from(tempByTime.keys()).sort((a, b) => a - b),
    tempByTime,
    rainByTime,
    cloudLowByTime,
    cloudMidByTime,
    cloudHighByTime,
    lclByTime,
    windByTimePressure,
    sortedWindPressures: Array.from(windPressuresSet).sort((a, b) => a - b),
  };
}

export interface ActiveState {
  gridIndex: number; // 0 | 1 | 2 | -1
  hoveredWindPressure: number | null;
}

export function createActiveState(): ActiveState {
  return { gridIndex: -1, hoveredWindPressure: null };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Snap `value` to the nearest element in a pre-sorted numeric array.
 * Returns null when the array is empty.
 */
export function snapToNearest(sorted: number[], value: number): number | null {
  if (!sorted.length) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  // lo is the first index >= value; compare with lo-1 to pick the closest.
  if (lo > 0 && Math.abs(sorted[lo - 1] - value) <= Math.abs(sorted[lo] - value)) {
    return sorted[lo - 1];
  }
  return sorted[lo];
}

/** Tiny helper to build an inline colour swatch for the tooltip. */
function swatch(color: string, dashed = false): string {
  if (dashed) {
    return (
      `<span style="display:inline-block;width:12px;height:0;` +
      `border-top:2px dashed ${color};vertical-align:middle;margin-right:3px"></span>`
    );
  }
  return (
    `<span style="display:inline-block;width:12px;height:2px;` +
    `background:${color};vertical-align:middle;margin-right:3px"></span>`
  );
}

// ─── Formatter factory ──────────────────────────────────────────────────────

export function formatTooltip(store: TooltipStore, active: ActiveState, timezone: string, hoveredTime: number): string {
  const snap = snapToNearest(store.sortedTimes, hoveredTime);
  if (snap == null) return '';
  const timeStr = fmtTime(new Date(snap), timezone);

  const { gridIndex, hoveredWindPressure } = active;

  let html =
    `<div style="font-weight:600;margin-bottom:4px;padding-bottom:3px;` +
    `border-bottom:1px solid #ddd;font-size:13px">🕐 ${timeStr}</div>`;

  // ── Grid 0 – Temperature / Dewpoint / Humidity ──────────────────────────
  if (gridIndex === 0 || gridIndex === -1) {
    const td = store.tempByTime.get(snap);
    if (td) {
      html += `<table style="border-collapse:collapse;width:100%;margin-bottom:4px">`;
      html +=
        `<tr><td style="padding:1px 4px 1px 0">` +
        swatch(CHART_COLORS.temperature) +
        `Temp</td><td style="text-align:right;font-weight:600">${td.temp.toFixed(1)}&nbsp;°C</td></tr>`;
      html +=
        `<tr><td style="padding:1px 4px 1px 0">` +
        swatch(CHART_COLORS.dewpoint) +
        `Dew</td><td style="text-align:right;font-weight:600">${td.dew.toFixed(1)}&nbsp;°C</td></tr>`;
      html +=
        `<tr><td style="padding:1px 4px 1px 0">` +
        swatch(CHART_COLORS.humidity, true) +
        `Humidity</td><td style="text-align:right;font-weight:600">${td.hum.toFixed(0)}&nbsp;%</td></tr>`;
      html += `</table>`;
    }
  }

  // ── Grid 1 – Rain / Cloud cover bands ──────────────────────────────────
  if (gridIndex === 1 || gridIndex === -1) {
    const low = store.cloudLowByTime.get(snap);
    const mid = store.cloudMidByTime.get(snap);
    const high = store.cloudHighByTime.get(snap);
    if (low != null || mid != null || high != null) {
      html += `<table style="border-collapse:collapse;width:100%;margin-bottom:4px">`;
      if (high != null)
        html += `<tr><td style="padding:1px 4px 1px 0">☁️ High cloud</td><td style="text-align:right;font-weight:600">${high}&nbsp;%</td></tr>`;
      if (mid != null)
        html += `<tr><td style="padding:1px 4px 1px 0">☁️ Mid cloud</td><td style="text-align:right;font-weight:600">${mid}&nbsp;%</td></tr>`;
      if (low != null)
        html += `<tr><td style="padding:1px 4px 1px 0">☁️ Low cloud</td><td style="text-align:right;font-weight:600">${low}&nbsp;%</td></tr>`;

      html += `</table>`;
    }
    const rain = store.rainByTime.get(snap);
    if (rain != null && rain !== 0) {
      html += `<div style="margin-bottom:3px">💧 Rain:&nbsp;<b>${rain.toFixed(1)}&nbsp;mm/h</b></div>`;
    }
  }

  // ── Grid 2 – Wind field ─────────────────────────────────────────────────
  if (gridIndex === 2 || gridIndex === -1) {
    // LCL line lives in the wind grid.
    const cb = store.lclByTime.get(snap);
    if (cb != null) {
      html +=
        `<div style="margin-bottom:3px">` +
        swatch(CHART_COLORS.lcl) +
        `LCL:&nbsp;<b>${Math.round(cb)}&nbsp;m</b></div>`;
    }

    if (gridIndex === 2 && hoveredWindPressure != null) {
      const nearestPressure = snapToNearest(store.sortedWindPressures, hoveredWindPressure);
      if (nearestPressure != null) {
        const w = store.windByTimePressure.get(`${snap}_${nearestPressure}`);
        if (w) {
          const col = windColorScale(w.speed);
          html += `<div style="margin-top:4px;padding-top:3px;border-top:1px solid #eee">`;
          html += `<table style="border-collapse:collapse;width:100%">`;
          html +=
            `<tr>` +
            `<td style="padding:0 4px 0 0;color:#666">${w.height}&nbsp;m</td>` +
            `<td style="color:${col};font-weight:600;text-align:right">${w.speed}&nbsp;km/h</td>` +
            `<td style="color:#555;text-align:right;padding-left:6px">${w.direction}°</td>` +
            `</tr>`;
          html += `</table></div>`;
        }
      }
    } else {
      // Fallback (unknown grid): show all levels in a compact table.
      const entries: { height: number; speed: number; direction: number }[] = [];
      for (const pressure of [...store.sortedWindPressures].reverse()) {
        const w = store.windByTimePressure.get(`${snap}_${pressure}`);
        if (w) entries.push(w);
      }
      if (entries.length) {
        html += `<div style="margin-top:4px;padding-top:3px;border-top:1px solid #eee;font-size:11px">`;
        html += `<b>Wind at ${timeStr}</b>`;
        html += `<table style="border-collapse:collapse;width:100%;margin-top:2px">`;
        for (const e of entries) {
          const col = windColorScale(e.speed);
          html +=
            `<tr>` +
            `<td style="padding:0 4px 0 0;color:#666">${e.height}&nbsp;m</td>` +
            `<td style="color:${col};font-weight:600;text-align:right">${e.speed}&nbsp;km/h</td>` +
            `<td style="color:#555;text-align:right;padding-left:6px">${e.direction}°</td>` +
            `</tr>`;
        }
        html += `</table></div>`;
      }
    }
  }

  return html;
}
