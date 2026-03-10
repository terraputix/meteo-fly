import type { TemperatureChartData, RainCloudChartData } from '$lib/workers/chartWorker.types';
import type { WindFieldLevel } from '$lib/charts/wind';
import { windColorScale } from '$lib/charts/scales';
import { CHART_COLORS } from '$lib/charts/chartColors';
import { fmtTime } from '$lib/helpers';

// ─── Tooltip store ──────────────────────────────────────────────────────────
// Pre-built look-up maps keyed by timestamp so the formatter is O(1).

export interface TooltipStore {
  tempByTime: Map<number, { temp: number; dew: number; hum: number }>;
  rainByTime: Map<number, number>;
  cloudLowByTime: Map<number, number>;
  cloudMidByTime: Map<number, number>;
  cloudHighByTime: Map<number, number>;
  cloudBaseByTime: Map<number, number>;
  windByTimeHeight: Map<string, { speed: number; direction: number }>;
  sortedWindTimes: number[];
  sortedWindHeights: number[];
}

export function buildTooltipStore(
  tempData: TemperatureChartData,
  rainData: RainCloudChartData,
  windData: WindFieldLevel[],
  cloudBase: Array<{ x: Date; y: number }>
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
    const mid = Math.round((r.x1.getTime() + r.x2.getTime()) / 2 / 3_600_000) * 3_600_000;
    if (r.y1 < 0.01) cloudLowByTime.set(mid, r.cloudCover);
    else if (r.y1 < 0.4) cloudMidByTime.set(mid, r.cloudCover);
    else cloudHighByTime.set(mid, r.cloudCover);
  });

  const cloudBaseByTime = new Map<number, number>();
  cloudBase.forEach((d) => cloudBaseByTime.set(d.x.getTime(), d.y));

  const windByTimeHeight = new Map<string, { speed: number; direction: number }>();
  const windTimesSet = new Set<number>();
  const windHeightsSet = new Set<number>();
  windData.forEach((w) => {
    const t = w.time.getTime();
    windByTimeHeight.set(`${t}_${w.height}`, { speed: w.speed, direction: w.direction });
    windTimesSet.add(t);
    windHeightsSet.add(w.height);
  });

  return {
    tempByTime,
    rainByTime,
    cloudLowByTime,
    cloudMidByTime,
    cloudHighByTime,
    cloudBaseByTime,
    windByTimeHeight,
    sortedWindTimes: Array.from(windTimesSet).sort((a, b) => a - b),
    sortedWindHeights: Array.from(windHeightsSet).sort((a, b) => a - b),
  };
}

// ─── CallbackDataParams (minimal subset used by tooltip) ────────────────────

export interface TooltipParam {
  seriesName?: string;
  value?: [number, number];
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

export function createTooltipFormatter(store: TooltipStore): (paramsRaw: TooltipParam | TooltipParam[]) => string {
  return (paramsRaw: TooltipParam | TooltipParam[]): string => {
    const params = Array.isArray(paramsRaw) ? paramsRaw : [paramsRaw];
    if (!params.length) return '';

    // Find the hovered time from any anchor series
    let hoveredTime: number | null = null;
    for (const p of params) {
      const v = p.value;
      if (Array.isArray(v) && v[0] != null) {
        hoveredTime = v[0] as number;
        break;
      }
    }
    if (hoveredTime == null) return '';

    // Snap to the nearest hour (data is hourly)
    const snap = Math.round(hoveredTime / 3_600_000) * 3_600_000;
    const timeStr = fmtTime(new Date(snap));

    let html =
      `<div style="font-weight:600;margin-bottom:4px;padding-bottom:3px;` +
      `border-bottom:1px solid #ddd;font-size:13px">🕐 ${timeStr}</div>`;

    // ── Temperature / Dewpoint / Humidity ──
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

    // ── Rain ──
    const rain = store.rainByTime.get(snap);
    if (rain != null && rain > 0) {
      html += `<div style="margin-bottom:3px">💧 Rain:&nbsp;<b>${rain.toFixed(1)}&nbsp;mm/h</b></div>`;
    }

    // ── Cloud cover bands ──
    const low = store.cloudLowByTime.get(snap);
    const mid = store.cloudMidByTime.get(snap);
    const high = store.cloudHighByTime.get(snap);
    if (low != null || mid != null || high != null) {
      html += `<table style="border-collapse:collapse;width:100%;margin-bottom:4px">`;
      if (low != null)
        html += `<tr><td style="padding:1px 4px 1px 0">☁ Low cloud</td><td style="text-align:right;font-weight:600">${low}&nbsp;%</td></tr>`;
      if (mid != null)
        html += `<tr><td style="padding:1px 4px 1px 0">☁ Mid cloud</td><td style="text-align:right;font-weight:600">${mid}&nbsp;%</td></tr>`;
      if (high != null)
        html += `<tr><td style="padding:1px 4px 1px 0">☁ High cloud</td><td style="text-align:right;font-weight:600">${high}&nbsp;%</td></tr>`;
      html += `</table>`;
    }

    // ── Cloud base ──
    const cb = store.cloudBaseByTime.get(snap);
    if (cb != null) {
      html +=
        `<div style="margin-bottom:3px">` +
        swatch(CHART_COLORS.cloudBase) +
        `Cloud base:&nbsp;<b>${Math.round(cb)}&nbsp;m</b></div>`;
    }

    const entries: { height: number; speed: number; direction: number }[] = [];
    for (const h of store.sortedWindHeights) {
      const w = store.windByTimeHeight.get(`${snap}_${h}`);
      if (w) entries.push({ height: h, speed: w.speed, direction: w.direction });
    }
    if (entries.length) {
      html += `<div style="margin-top:4px;padding-top:3px;border-top:1px solid #eee;font-size:11px">`;
      html += `<b>Wind at ${timeStr}</b>`;
      html += `<table style="border-collapse:collapse;width:100%;margin-top:2px">`;
      for (const e of entries) {
        const col = windColorScale(e.speed) as string;
        html +=
          `<tr>` +
          `<td style="padding:0 4px 0 0;color:#666">${e.height}&nbsp;m</td>` +
          `<td style="color:${col};font-weight:600;text-align:right">${e.speed}&nbsp;km/h</td>` +
          `<td style="color:#555;text-align:right;padding-left:6px">${e.direction}°</td>` +
          `</tr>`;
      }
      html += `</table></div>`;
    }

    return html;
  };
}
