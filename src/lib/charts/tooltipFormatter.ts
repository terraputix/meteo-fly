import type { TemperatureChartData, RainCloudChartData } from '#lib/workers/chartWorker.types.js';
import type { WindFieldLevel } from '#lib/charts/wind.js';
import { windDirectionLabel } from '#lib/meteo/wind.js';
import { CHART_COLORS } from '#lib/charts/chartColors.js';
import { fmtTime } from '#lib/helpers.js';
import type { LclPoint } from '#lib/meteo/lcl.js';
import type { CloudCoverData } from '#lib/charts/clouds.js';

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
  cloudByTimePressure: Map<string, number>;
  sortedCloudPressures: number[];
}

export function buildTooltipStore(
  tempData: TemperatureChartData,
  rainData: RainCloudChartData,
  windData: WindFieldLevel[],
  cloudBase: LclPoint[],
  cloudData: CloudCoverData[] = []
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

  const cloudByTimePressure = new Map(cloudData.map((cloud) => [`${+cloud.time}_${cloud.pressure}`, cloud.value]));
  const sortedCloudPressures = [...new Set(cloudData.map((cloud) => cloud.pressure))].sort((a, b) => a - b);

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
    cloudByTimePressure,
    sortedCloudPressures,
  };
}

export interface ActiveState {
  gridIndex: number; // 0 | 1 | 2 | -1
  hoveredWindPressure: number | null;
  showLcl?: boolean;
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

function swatch(color: string, dashed = false): string {
  return `<span aria-hidden="true" class="inline-block w-3 shrink-0 border-t-2" style="border-color:${color};border-style:${dashed ? 'dashed' : 'solid'}"></span>`;
}

function measurement(value: number | undefined, unit: string, decimals?: number): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${decimals == null ? value : value.toFixed(decimals)}&nbsp;${unit}`;
}

function metricRow(label: string, value: string, color?: string, dashed = false): string {
  return `<div class="flex items-center justify-between gap-3 py-0.5">
    <span class="flex items-center gap-1.5 text-slate-500">${color ? swatch(color, dashed) : ''}${label}</span>
    <span class="whitespace-nowrap font-medium text-slate-800">${value}</span>
  </div>`;
}

export function formatTooltip(store: TooltipStore, active: ActiveState, timezone: string, hoveredTime: number): string {
  const snap = snapToNearest(store.sortedTimes, hoveredTime);
  if (snap == null) return '';
  const timeStr = fmtTime(new Date(snap), timezone);
  const { gridIndex, hoveredWindPressure } = active;
  const panelLabel =
    gridIndex === 0 ? 'Surface' : gridIndex === 1 ? 'Clouds & rain' : gridIndex === 2 ? 'Wind' : 'Forecast';
  let html = `<div class="mb-1 flex items-center justify-between gap-3 border-b border-slate-100 pb-1">
    <span class="font-semibold text-slate-900">${timeStr}</span>
    <span class="text-[10px] font-medium text-slate-500">${panelLabel}</span>
  </div>`;

  if (gridIndex === 0 || gridIndex === -1) {
    const td = store.tempByTime.get(snap);
    if (td) {
      html += metricRow('Temperature', measurement(td.temp, '°C', 1), CHART_COLORS.temperature);
      html += metricRow('Dewpoint', measurement(td.dew, '°C', 1), CHART_COLORS.dewpoint);
      html += metricRow('Humidity', measurement(td.hum, '%', 0), CHART_COLORS.humidity, true);
    }
  }

  if (gridIndex === 1 || gridIndex === -1) {
    for (const [label, values] of [
      ['High cloud', store.cloudHighByTime],
      ['Mid cloud', store.cloudMidByTime],
      ['Low cloud', store.cloudLowByTime],
    ] as const) {
      const cover = values.get(snap);
      if (cover != null) html += metricRow(label, measurement(cover, '%', 0));
    }
    const rain = store.rainByTime.get(snap);
    if (rain != null) {
      html += `<div class="mt-1 border-t border-slate-100 pt-1">${metricRow('Rain', measurement(rain, 'mm/h', 1), CHART_COLORS.rain)}</div>`;
    }
  }

  if (gridIndex === 2 || gridIndex === -1) {
    const nearestPressure =
      hoveredWindPressure == null ? null : snapToNearest(store.sortedWindPressures, hoveredWindPressure);
    const pressures =
      gridIndex === 2 && hoveredWindPressure != null
        ? nearestPressure == null
          ? []
          : [nearestPressure]
        : [...store.sortedWindPressures].reverse();
    for (const pressure of pressures) {
      const wind = store.windByTimePressure.get(`${snap}_${pressure}`);
      if (!wind) continue;
      html += `<div class="py-0.5">
        <div class="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span>${pressure}&nbsp;hPa</span>
          <span aria-hidden="true" class="text-slate-300">·</span>
          <span>≈${measurement(wind.height, 'm')}</span>
        </div>
        <div class="flex items-center justify-between gap-3 py-0.5">
          <span class="font-semibold text-slate-900">
            ${measurement(wind.speed, 'km/h')}
          </span>
          <span class="text-slate-600">${windDirectionLabel(wind.direction)} (${wind.direction}°)</span>
        </div>
      </div>`;
      const cloudPressure = snapToNearest(store.sortedCloudPressures, pressure);
      const cloudCover = cloudPressure == null ? undefined : store.cloudByTimePressure.get(`${snap}_${cloudPressure}`);
      const cloudLabel =
        cloudPressure != null && cloudPressure !== pressure ? `Cloud (${cloudPressure} hPa)` : 'Cloud cover';
      html += metricRow(cloudLabel, measurement(cloudCover, '%', 0));
    }
    const cb = store.lclByTime.get(snap);
    if (cb != null && gridIndex === 2 && active.showLcl) {
      html += `<div class="mt-1 border-t border-slate-100 pt-1">${metricRow('LCL', measurement(cb, 'm', 0), CHART_COLORS.lcl)}</div>`;
    }
  }

  return html;
}
