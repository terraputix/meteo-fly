import {
  RD,
  CP,
  EPS,
  inverseSaturationVaporPressure,
  moistAdiabaticLapseRate,
  saturationVaporPressure,
} from '$lib/meteo/thermo';
import { CHART_COLORS } from '$lib/charts/chartColors';
import { windColorScale, strokeWidthScale } from '$lib/charts/scales';
import { calculateDryParcelTemperature } from '$lib/meteo/thermal';
import { type SkewTData, type SkewTLevelData, type SkewTTrace, type ThermalLevelData } from '$lib/meteo/types';

// ─── Configuration ─────────────────────────────────────────────────────────────

const SKEW_OFFSET = 40;
const PRESSURE_SAMPLE_COUNT = 84;
const TEMP_PADDING = 12;
export const SKEWT_PLOT_TOP = 30;

const ADIABAT_OPACITY = 0.7;
const ADIABAT_WIDTH = 0.85;
const MOIST_ADIABAT_OPACITY = 0.7;
const MOIST_ADIABAT_WIDTH = 0.7;
const ISO_COLOR = '#eee';
const AXIS_COLOR = '#ccc';

const DRY_THETAS = [-20, -10, 0, 10, 20, 30, 40, 50, 60, 70, 80];
const MOIST_STARTS = [-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40];
const MIXING_RATIOS = [0.32, 0.8, 1.8, 2.6, 3.8, 5.8, 7.8, 11, 15, 20, 28, 49, 88];

// ─── Coordinate helpers ────────────────────────────────────────────────────────

export interface PlotLayout {
  plotLeft: number;
  plotTop: number;
  plotWidth: number;
  plotHeight: number;
  minP: number;
  maxP: number;
  tempMin: number;
  tempMax: number;
  skewXMin: number;
  skewXMax: number;
  skewXRange: number;
  pressureLevels: readonly number[];
  pressureSamples: number[];
  levelByPressure: Map<number, SkewTLevelData>;
}

function yNorm(p: number, minP: number, maxP: number): number {
  return (Math.log(p) - Math.log(minP)) / (Math.log(maxP) - Math.log(minP));
}

function canvasYFn(yn: number, plotTop: number, plotHeight: number): number {
  return plotTop + yn * plotHeight;
}

function canvasToYNorm(canvasYVal: number, plotTop: number, plotHeight: number): number {
  return (canvasYVal - plotTop) / plotHeight;
}

function yNormToPressure(yn: number, minP: number, maxP: number): number {
  return Math.exp(yn * (Math.log(maxP) - Math.log(minP)) + Math.log(minP));
}

function skewX(layout: PlotLayout, temperature: number, yn: number): number {
  return temperature + SKEW_OFFSET * (1 - yn);
}

function canvasXFn(layout: PlotLayout, sx: number): number {
  return layout.plotLeft + ((sx - layout.skewXMin) / layout.skewXRange) * layout.plotWidth;
}

function canvasToSkewX(layout: PlotLayout, cx: number): number {
  return ((cx - layout.plotLeft) / layout.plotWidth) * layout.skewXRange + layout.skewXMin;
}

function tempPressureToCanvas(layout: PlotLayout, temp: number, p: number): [number, number] {
  const yn = yNorm(p, layout.minP, layout.maxP);
  return [canvasXFn(layout, skewX(layout, temp, yn)), canvasYFn(yn, layout.plotTop, layout.plotHeight)];
}

function pressureToCanvasY(layout: PlotLayout, p: number): number {
  return canvasYFn(yNorm(p, layout.minP, layout.maxP), layout.plotTop, layout.plotHeight);
}

// ─── Layout builder ────────────────────────────────────────────────────────────

function buildPressureSamples(minP: number, maxP: number, count: number): number[] {
  const samples: number[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    samples.push(yNormToPressure(t, minP, maxP));
  }
  return samples;
}

function roundToNice(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function computeTempRange(
  trace: SkewTTrace,
  minP: number,
  maxP: number,
  padding: number
): { tempMin: number; tempMax: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const level of trace.levels) {
    const yn = yNorm(level.pressure, minP, maxP);
    if (isFinite(level.temperature)) {
      const skewed = level.temperature + SKEW_OFFSET * (1 - yn);
      lo = Math.min(lo, skewed);
      hi = Math.max(hi, skewed);
    }
    if (isFinite(level.dewpoint)) {
      const skewed = level.dewpoint + SKEW_OFFSET * (1 - yn);
      lo = Math.min(lo, skewed);
      hi = Math.max(hi, skewed);
    }
  }
  for (const level of trace.thermal.levels) {
    if (trace.thermal.topPressure == null || level.pressure < trace.thermal.topPressure) continue;
    const yn = yNorm(level.pressure, minP, maxP);
    if (isFinite(level.parcelTemperature)) {
      const skewed = level.parcelTemperature + SKEW_OFFSET * (1 - yn);
      lo = Math.min(lo, skewed);
      hi = Math.max(hi, skewed);
    }
  }
  if (!isFinite(lo)) return { tempMin: -40, tempMax: 40 };

  let tempMin = roundToNice(lo - padding, 5);
  let tempMax = roundToNice(hi + padding, 5);
  if (tempMax - tempMin < 25) {
    const mid = (tempMin + tempMax) / 2;
    tempMin = roundToNice(mid - 12.5, 5);
    tempMax = roundToNice(mid + 12.5, 5);
  }
  return { tempMin, tempMax };
}

function buildLayout(
  trace: SkewTTrace,
  pressureLevels: number[],
  plotLeft: number,
  plotTop: number,
  plotWidth: number,
  plotHeight: number
): PlotLayout | null {
  pressureLevels.sort((a, b) => b - a);
  const minP = Math.min(...pressureLevels);
  const maxP = Math.max(...pressureLevels);
  const pressureSamples = buildPressureSamples(minP, maxP, PRESSURE_SAMPLE_COUNT);

  const levelByPressure = new Map<number, SkewTLevelData>();
  trace.levels.forEach((l) => levelByPressure.set(l.pressure, l));

  const { tempMin, tempMax } = computeTempRange(trace, minP, maxP, TEMP_PADDING);
  const skewXMin = tempMin;
  const skewXMax = tempMax;
  const skewXRange = skewXMax - skewXMin;

  return {
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
    minP,
    maxP,
    tempMin,
    tempMax,
    skewXMin,
    skewXMax,
    skewXRange,
    pressureLevels,
    pressureSamples,
    levelByPressure,
  };
}

// ─── Drawing primitives ────────────────────────────────────────────────────────

function drawLine(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  stroke: string,
  width: number,
  dash?: [number, number],
  opacity?: number
) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  if (opacity !== undefined) ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  align: CanvasTextAlign,
  baseline: CanvasTextBaseline,
  font?: string
) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.font = font ?? '11px sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawDryAdiabat(ctx: CanvasRenderingContext2D, layout: PlotLayout, thetaC: number) {
  const thetaK = thetaC + 273.15;
  const pts: [number, number][] = [];
  for (const p of layout.pressureSamples) {
    const tC = thetaK * Math.pow(p / 1000, RD / CP) - 273.15;
    pts.push(tempPressureToCanvas(layout, tC, p));
  }
  drawLine(ctx, pts, CHART_COLORS.dryAdiabat, ADIABAT_WIDTH, [4, 4], ADIABAT_OPACITY);
}

function drawDryAdiabats(ctx: CanvasRenderingContext2D, layout: PlotLayout) {
  for (const theta of DRY_THETAS) {
    drawDryAdiabat(ctx, layout, theta);
  }
}

// ─── Moist adiabats ────────────────────────────────────────────────────────────

function drawMoistAdiabats(ctx: CanvasRenderingContext2D, layout: PlotLayout) {
  const levels = layout.pressureSamples.slice().reverse();
  for (const startT of MOIST_STARTS) {
    const pts: [number, number][] = [];
    let t = startT;
    for (let i = 0; i < levels.length; i++) {
      const p = levels[i];
      pts.push(tempPressureToCanvas(layout, t, p));
      if (i < levels.length - 1) {
        const dp = levels[i + 1] - p;
        t += moistAdiabaticLapseRate(t, p) * dp;
      }
    }
    drawLine(ctx, pts, CHART_COLORS.moistAdiabat, MOIST_ADIABAT_WIDTH, [2, 4], MOIST_ADIABAT_OPACITY);
  }
}

// ─── Mixing ratio lines ─────────────────────────────────────────────────────────

function drawMixingLines(ctx: CanvasRenderingContext2D, layout: PlotLayout) {
  for (const w of MIXING_RATIOS) {
    const w_kg = w / 1000;
    const pts: [number, number][] = [];
    for (const p of layout.pressureSamples) {
      const e = (w_kg * p) / (EPS + w_kg);
      if (e <= 0) continue;
      const tC = inverseSaturationVaporPressure(e);
      pts.push(tempPressureToCanvas(layout, tC, p));
    }
    drawLine(ctx, pts, CHART_COLORS.isohume, 0.7, [3, 4], 0.7);
  }
}

// ─── Background grid ───────────────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, layout: PlotLayout) {
  const { plotLeft, plotTop, plotWidth, plotHeight, tempMin, tempMax } = layout;

  // Clip to plot box so no lines spill outside
  ctx.save();
  ctx.beginPath();
  ctx.rect(plotLeft, plotTop, plotWidth, plotHeight);
  ctx.clip();

  ctx.fillStyle = '#fff';
  ctx.fillRect(plotLeft, plotTop, plotWidth, plotHeight);

  // Isobars (horizontal lines)
  for (const p of layout.pressureLevels) {
    const y = pressureToCanvasY(layout, p);
    drawLine(
      ctx,
      [
        [plotLeft, y],
        [plotLeft + plotWidth, y],
      ],
      ISO_COLOR,
      0.5
    );
  }

  // Isotherms (diagonal lines)
  const isoStart = Math.ceil(tempMin / 10) * 10;
  const isoEnd = Math.floor(tempMax / 10) * 10;
  for (let t = isoStart; t <= isoEnd; t += 10) {
    const pts: [number, number][] = [];
    for (const p of layout.pressureSamples) {
      pts.push(tempPressureToCanvas(layout, t, p));
    }
    if (t === 0) {
      drawLine(ctx, pts, '#bbb', 1.2);
    } else {
      drawLine(ctx, pts, ISO_COLOR, ADIABAT_WIDTH, undefined, ADIABAT_OPACITY);
    }
  }

  // Mixing ratio lines
  drawMixingLines(ctx, layout);

  // Dry adiabats
  drawDryAdiabats(ctx, layout);
  // Moist adiabats
  drawMoistAdiabats(ctx, layout);

  ctx.restore();
}

// ─── Axis ──────────────────────────────────────────────────────────────────────

function drawAxis(ctx: CanvasRenderingContext2D, layout: PlotLayout) {
  const { plotLeft, plotTop, plotWidth, plotHeight } = layout;

  ctx.save();
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft + plotWidth, plotTop);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop + plotHeight);
  ctx.lineTo(plotLeft + plotWidth, plotTop + plotHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotTop + plotHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(plotLeft + plotWidth, plotTop);
  ctx.lineTo(plotLeft + plotWidth, plotTop + plotHeight);
  ctx.stroke();
  ctx.restore();

  // Pressure labels (left side)
  for (const p of layout.pressureLevels) {
    if (p === layout.minP) continue;
    const y = pressureToCanvasY(layout, p);
    drawText(ctx, `${p}`, plotLeft - 8, y, '#666', 'right', 'middle');
  }

  // Temperature labels (bottom axis)
  const isoStart = Math.ceil(layout.tempMin / 10) * 10;
  const isoEnd = Math.floor(layout.tempMax / 10) * 10;
  for (let t = isoStart; t <= isoEnd; t += 10) {
    const [x] = tempPressureToCanvas(layout, t, layout.maxP);
    if (x < plotLeft || x > plotLeft + plotWidth) continue;
    drawText(ctx, `${t}°`, x, plotTop + plotHeight + 16, '#666', 'center', 'top');
    ctx.save();
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, plotTop + plotHeight);
    ctx.lineTo(x, plotTop + plotHeight + 5);
    ctx.stroke();
    ctx.restore();
  }
}

// ─── Data traces ──────────────────────────────────────────────────────────────

function drawTraces(ctx: CanvasRenderingContext2D, trace: SkewTTrace, layout: PlotLayout) {
  const tempPts: [number, number][] = trace.levels.map((l) => tempPressureToCanvas(layout, l.temperature, l.pressure));
  drawLine(ctx, tempPts, CHART_COLORS.temperature, 2);
  ctx.save();
  ctx.fillStyle = CHART_COLORS.temperature;
  for (let i = 0; i < trace.levels.length; i++) {
    if (!trace.levels[i].isInterpolated) {
      const [x, y] = tempPts[i];
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  const dewPts: [number, number][] = trace.levels.map((l) => tempPressureToCanvas(layout, l.dewpoint, l.pressure));
  drawLine(ctx, dewPts, CHART_COLORS.dewpoint, 2);
  ctx.save();
  ctx.fillStyle = CHART_COLORS.dewpoint;
  for (let i = 0; i < trace.levels.length; i++) {
    if (!trace.levels[i].isInterpolated) {
      const [x, y] = dewPts[i];
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function interpolateThermalLevelAtPressure(trace: SkewTTrace, pressure: number): ThermalLevelData | null {
  const exact = trace.thermal.levels.find((level) => Math.abs(level.pressure - pressure) < 0.01);
  if (exact) return exact;

  for (let i = 0; i < trace.thermal.levels.length - 1; i++) {
    const lower = trace.thermal.levels[i];
    const upper = trace.thermal.levels[i + 1];
    if (pressure >= lower.pressure || pressure <= upper.pressure) continue;

    const ratio =
      (Math.log(pressure) - Math.log(lower.pressure)) / (Math.log(upper.pressure) - Math.log(lower.pressure));
    const interpolate = (from: number, to: number) => from + (to - from) * ratio;
    const environmentTemperature = interpolate(lower.environmentTemperature, upper.environmentTemperature);
    const parcelTemperature = calculateDryParcelTemperature(trace.surfaceTemp, trace.surfacePressure, pressure);
    return {
      pressure,
      heightMeters: interpolate(lower.heightMeters, upper.heightMeters),
      environmentTemperature,
      parcelTemperature,
      thermalIndex: environmentTemperature - parcelTemperature,
      triggerTemperature: interpolate(lower.triggerTemperature, upper.triggerTemperature),
      isSurface: false,
    };
  }

  return null;
}

function thermalLevelsToTop(trace: SkewTTrace): ThermalLevelData[] {
  const topPressure = trace.thermal.topPressure;
  if (topPressure == null) return [];

  const levels = trace.thermal.levels.filter((level) => level.pressure >= topPressure);
  let topLevel = interpolateThermalLevelAtPressure(trace, topPressure);
  if (topLevel && !trace.thermal.topIsAboveProfile) {
    topLevel = { ...topLevel, environmentTemperature: topLevel.parcelTemperature, thermalIndex: 0 };
  }
  if (topLevel) {
    const existingIndex = levels.findIndex((level) => Math.abs(level.pressure - topPressure) < 0.01);
    if (existingIndex >= 0) levels[existingIndex] = topLevel;
    else levels.push(topLevel);
  }
  return levels.sort((a, b) => b.pressure - a.pressure);
}

function drawThermalBuoyancy(ctx: CanvasRenderingContext2D, trace: SkewTTrace, layout: PlotLayout) {
  const levels = thermalLevelsToTop(trace).filter(
    (level) => level.pressure >= layout.minP && level.pressure <= layout.maxP
  );
  if (levels.length < 2) return;

  const surfaceProfileTemperature = interpolateAtPressure(trace.levels, trace.surfacePressure, 'temperature');
  const environmentPoints = levels.map((level) => {
    const temperature =
      level.isSurface && surfaceProfileTemperature != null && Number.isFinite(surfaceProfileTemperature)
        ? surfaceProfileTemperature
        : level.environmentTemperature;
    return tempPressureToCanvas(layout, temperature, level.pressure);
  });
  const parcelPoints = levels.map((level) => tempPressureToCanvas(layout, level.parcelTemperature, level.pressure));

  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.plotLeft, layout.plotTop, layout.plotWidth, layout.plotHeight);
  ctx.clip();
  ctx.fillStyle = 'rgba(234, 88, 12, 0.14)';
  ctx.beginPath();
  ctx.moveTo(environmentPoints[0][0], environmentPoints[0][1]);
  for (let i = 1; i < environmentPoints.length; i++) ctx.lineTo(environmentPoints[i][0], environmentPoints[i][1]);
  for (let i = parcelPoints.length - 1; i >= 0; i--) ctx.lineTo(parcelPoints[i][0], parcelPoints[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawThermalDiagnostics(ctx: CanvasRenderingContext2D, trace: SkewTTrace, layout: PlotLayout) {
  const { topPressure, topHeightMeters, topIsAboveProfile } = trace.thermal;
  if (topPressure == null || topHeightMeters == null) return;

  const parcelPoints = thermalLevelsToTop(trace)
    .filter(
      (level) =>
        Number.isFinite(level.parcelTemperature) &&
        level.pressure >= topPressure &&
        level.pressure >= layout.minP &&
        level.pressure <= layout.maxP
    )
    .map((level) => tempPressureToCanvas(layout, level.parcelTemperature, level.pressure));

  drawLine(ctx, parcelPoints, CHART_COLORS.thermalParcel, 1.5, [5, 3], 0.9);

  if (topPressure < layout.minP || topPressure > layout.maxP) return;

  const y = pressureToCanvasY(layout, topPressure);
  drawLine(
    ctx,
    [
      [layout.plotLeft, y],
      [layout.plotLeft + layout.plotWidth, y],
    ],
    CHART_COLORS.thermalTop,
    1,
    [5, 3]
  );
  drawText(
    ctx,
    `${topIsAboveProfile ? 'Dry top >' : 'Dry top'} ${Math.round(trace.thermal.topHeightAglMeters ?? 0)}m AGL`,
    layout.plotLeft + 4,
    y - 4,
    CHART_COLORS.thermalTop,
    'left',
    'bottom',
    '10px sans-serif'
  );
}

// ─── Annotations ───────────────────────────────────────────────────────────────

function drawAnnotations(ctx: CanvasRenderingContext2D, trace: SkewTTrace, layout: PlotLayout) {
  const { plotLeft, plotWidth } = layout;

  if (trace.lclPressure != null && trace.lclPressure >= layout.minP && trace.lclPressure <= layout.maxP) {
    const lclY = pressureToCanvasY(layout, trace.lclPressure);
    drawLine(
      ctx,
      [
        [plotLeft, lclY],
        [plotLeft + plotWidth, lclY],
      ],
      CHART_COLORS.lcl,
      1,
      [3, 3]
    );
    drawText(
      ctx,
      `LCL (${Math.round(trace.lclHeightAglMeters)}m AGL)`,
      plotLeft + plotWidth - 4,
      lclY - 4,
      CHART_COLORS.lcl,
      'right',
      'bottom'
    );

    if (trace.thermal.reachesLcl === true) {
      const lclLevel = interpolateThermalLevelAtPressure(trace, trace.lclPressure);
      if (lclLevel) {
        const [parcelX] = tempPressureToCanvas(layout, lclLevel.parcelTemperature, trace.lclPressure);
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = CHART_COLORS.lcl;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(parcelX, lclY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Surface temperature & dewpoint markers at the forecast surface pressure
  const surfacePressure = trace.surfacePressure;
  if (surfacePressure >= layout.minP && surfacePressure <= layout.maxP) {
    const surfaceY = pressureToCanvasY(layout, surfacePressure);
    const [stX] = tempPressureToCanvas(layout, trace.surfaceTemp, surfacePressure);
    const [sdX] = tempPressureToCanvas(layout, trace.surfaceDewpoint, surfacePressure);

    ctx.save();
    ctx.fillStyle = CHART_COLORS.temperature;
    ctx.beginPath();
    ctx.arc(stX, surfaceY, 3, 0, Math.PI * 2);
    ctx.fill();
    drawText(
      ctx,
      `${trace.surfaceTemp.toFixed(1)}°C`,
      stX + 6,
      surfaceY + 8,
      CHART_COLORS.temperature,
      'center',
      'top',
      '10px sans-serif'
    );

    ctx.fillStyle = CHART_COLORS.dewpoint;
    ctx.beginPath();
    ctx.arc(sdX, surfaceY, 3, 0, Math.PI * 2);
    ctx.fill();
    drawText(
      ctx,
      `${trace.surfaceDewpoint.toFixed(1)}°C`,
      sdX + 6,
      surfaceY + 8,
      CHART_COLORS.dewpoint,
      'center',
      'top',
      '10px sans-serif'
    );
    ctx.restore();
  }

  const arrowX = plotLeft + plotWidth + 50;
  for (const level of trace.levels) {
    const y = pressureToCanvasY(layout, level.pressure);
    const rotation = ((level.windDirection - 180) * Math.PI) / 180;
    ctx.save();
    ctx.translate(arrowX, y);
    ctx.rotate(rotation);
    ctx.strokeStyle = windColorScale(level.windSpeed);
    ctx.lineWidth = strokeWidthScale(level.windSpeed);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = level.isInterpolated ? 0.4 : 1;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(0, -7);
    ctx.lineTo(3.15, -1.54);
    ctx.moveTo(0, -7);
    ctx.lineTo(-3.15, -1.54);
    ctx.stroke();
    ctx.restore();
  }

  drawText(ctx, 'Wind', arrowX, layout.plotTop - 8, '#666', 'center', 'bottom');
}

// ─── Cloud cover ───────────────────────────────────────────────────────────────

function drawCloudCover(ctx: CanvasRenderingContext2D, trace: SkewTTrace, layout: PlotLayout) {
  const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
  const stripX = plotLeft + plotWidth - 18;
  const stripWidth = 16;

  ctx.save();
  ctx.beginPath();
  ctx.rect(plotLeft, plotTop, plotWidth, plotHeight);
  ctx.clip();

  for (let i = 0; i < trace.levels.length - 1; i++) {
    const level = trace.levels[i];
    const nextLevel = trace.levels[i + 1];
    const avgCloud = (level.cloudCover + nextLevel.cloudCover) / 2;
    if (!Number.isFinite(avgCloud) || avgCloud <= 2) continue;

    const y0 = pressureToCanvasY(layout, level.pressure);
    const y1 = pressureToCanvasY(layout, nextLevel.pressure);
    const y = Math.min(y0, y1);
    const h = Math.abs(y1 - y0);

    ctx.fillStyle = `${CHART_COLORS.cloudRect}${(avgCloud / 100).toFixed(3)})`;
    ctx.fillRect(stripX, y, stripWidth, h);
  }

  ctx.restore();
}

// ─── Model surface ─────────────────────────────────────────────────────────────

function drawModelSurfaceLine(
  ctx: CanvasRenderingContext2D,
  surfacePressure: number,
  modelGridElevation: number,
  layout: PlotLayout
) {
  const { plotLeft, plotWidth, minP, maxP } = layout;
  if (surfacePressure < minP || surfacePressure > maxP) return;

  const y = pressureToCanvasY(layout, surfacePressure);
  drawLine(
    ctx,
    [
      [plotLeft, y],
      [plotLeft + plotWidth, y],
    ],
    CHART_COLORS.modelGridElevation,
    1,
    [3, 3]
  );
  drawText(
    ctx,
    `Model Grid Elev. ${Math.round(modelGridElevation)}m`,
    plotLeft + 4,
    y - 4,
    CHART_COLORS.modelGridElevation,
    'left',
    'bottom'
  );
}

// ─── Hover overlay ─────────────────────────────────────────────────────────────

function interpolateAtPressure(
  levels: SkewTLevelData[],
  targetPressure: number,
  field: 'temperature' | 'dewpoint'
): number | null {
  for (let i = 0; i < levels.length - 1; i++) {
    const a = levels[i];
    const b = levels[i + 1];
    if (a.pressure >= targetPressure && b.pressure <= targetPressure) {
      const t = (targetPressure - a.pressure) / (b.pressure - a.pressure);
      return a[field] + (b[field] - a[field]) * t;
    }
  }
  const nearest = levels.reduce((best, l) =>
    Math.abs(l.pressure - targetPressure) < Math.abs(best.pressure - targetPressure) ? l : best
  );
  return nearest[field];
}

export function renderHoverOverlay(
  ctx: CanvasRenderingContext2D,
  layout: PlotLayout,
  trace: SkewTTrace,
  hitResult: HitTestResult,
  canvasWidth: number
): void {
  const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
  const mouseY = pressureToCanvasY(layout, hitResult.pressure);

  ctx.save();

  // ── Left-side: pressure / altitude box ─────────────────────────────────────
  {
    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    const line1 = `${Math.round(hitResult.pressure)} hPa`;
    const line2 = `${Math.round(hitResult.heightMeters)} m`;
    const w1 = ctx.measureText(line1).width;
    const w2 = ctx.measureText(line2).width;
    ctx.restore();

    const lineHeight = 14;
    const padX = 8;
    const padY = 4;
    const boxW = Math.max(w1, w2) + padX * 2;
    const boxH = lineHeight * 2 + padY * 2;
    const boxX = 4;
    const boxY = mouseY - boxH / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    roundRect(ctx, boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Tick from plot edge to box
    ctx.save();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boxX + boxW + 2, mouseY);
    ctx.lineTo(plotLeft, mouseY);
    ctx.stroke();
    ctx.restore();

    drawText(
      ctx,
      line1,
      boxX + boxW / 2,
      boxY + padY + lineHeight * 0.5,
      '#333',
      'center',
      'middle',
      'bold 11px sans-serif'
    );
    drawText(
      ctx,
      line2,
      boxX + boxW / 2,
      boxY + padY + lineHeight * 1.5,
      '#888',
      'center',
      'middle',
      '11px sans-serif'
    );
  }

  // ── Right-side: wind box ─────────────────────────────────────────────────────
  {
    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    const label = `${hitResult.windSpeed.toFixed(1)} km/h @ ${hitResult.windDirection}°`;
    const textW = ctx.measureText(label).width;
    ctx.restore();

    const lineHeight = 16;
    const padX = 8;
    const padY = 4;
    const boxW = textW + padX * 2;
    const boxH = lineHeight + padY * 2;
    const boxX = canvasWidth - boxW - 4;
    const boxY = mouseY - boxH / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    roundRect(ctx, boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Tick from plot edge to box
    ctx.save();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft + plotWidth, mouseY);
    ctx.lineTo(boxX - 2, mouseY);
    ctx.stroke();
    ctx.restore();

    drawText(ctx, label, boxX + boxW / 2, boxY + boxH / 2, '#333', 'center', 'middle', 'bold 11px sans-serif');
  }

  const surfacePressure = trace.surfacePressure;
  const surfaceY = pressureToCanvasY(layout, surfacePressure);

  // Collect x-axis labels to draw after clip restore
  const axisLabels: { x: number; text: string; atSurface: boolean }[] = [];

  // Clip to plot area for all internal elements
  ctx.save();
  ctx.beginPath();
  ctx.rect(plotLeft, plotTop, plotWidth, plotHeight);
  ctx.clip();

  // ── Horizontal crosshair ────────────────────────────────────────────────────
  drawLine(
    ctx,
    [
      [plotLeft, mouseY],
      [plotLeft + plotWidth, mouseY],
    ],
    '#999',
    0.5,
    [3, 3]
  );

  // ── Temperature/dewpoint trace labels ─────────────────────────────────────────────────────────
  {
    const interpTemp = interpolateAtPressure(trace.levels, hitResult.pressure, 'temperature');
    const interpDew = interpolateAtPressure(trace.levels, hitResult.pressure, 'dewpoint');
    if (interpTemp != null) {
      const [tx] = tempPressureToCanvas(layout, interpTemp, hitResult.pressure);
      ctx.save();
      ctx.fillStyle = CHART_COLORS.temperature;
      ctx.beginPath();
      ctx.arc(tx, mouseY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawText(
        ctx,
        `${interpTemp.toFixed(1)}°C`,
        tx - 8,
        mouseY - 10,
        CHART_COLORS.temperature,
        'right',
        'bottom',
        '12px sans-serif'
      );
    }
    if (interpDew != null) {
      const [dx] = tempPressureToCanvas(layout, interpDew, hitResult.pressure);
      ctx.save();
      ctx.fillStyle = CHART_COLORS.dewpoint;
      ctx.beginPath();
      ctx.arc(dx, mouseY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawText(
        ctx,
        `${interpDew.toFixed(1)}°C`,
        dx - 8,
        mouseY + 10,
        CHART_COLORS.dewpoint,
        'right',
        'top',
        '12px sans-serif'
      );
    }
  }

  // ── Surface parcel and Thermal Index ────────────────────────────────────────
  {
    const topPressure = trace.thermal.topPressure;
    const thermalLevel =
      topPressure != null && hitResult.pressure >= topPressure && hitResult.pressure <= trace.surfacePressure
        ? interpolateThermalLevelAtPressure(trace, hitResult.pressure)
        : null;
    if (thermalLevel) {
      const [parcelX] = tempPressureToCanvas(layout, thermalLevel.parcelTemperature, hitResult.pressure);
      const parcelLabel = `Parcel ${thermalLevel.parcelTemperature.toFixed(1)}°C`;
      const thermalIndexLabel = `TI ${thermalLevel.thermalIndex > 0 ? '+' : ''}${thermalLevel.thermalIndex.toFixed(1)}°C`;

      ctx.save();
      ctx.fillStyle = CHART_COLORS.thermalParcel;
      ctx.beginPath();
      ctx.arc(parcelX, mouseY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '11px sans-serif';
      const boxWidth = Math.max(ctx.measureText(parcelLabel).width, ctx.measureText(thermalIndexLabel).width) + 12;
      const boxHeight = 36;
      const preferredX = parcelX + 8;
      const boxX =
        preferredX + boxWidth <= plotLeft + plotWidth ? preferredX : Math.max(plotLeft, parcelX - boxWidth - 8);
      const boxY = Math.max(plotTop, Math.min(mouseY - boxHeight / 2, plotTop + plotHeight - boxHeight));
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.strokeStyle = CHART_COLORS.thermalParcel;
      ctx.lineWidth = 1;
      roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      drawText(ctx, parcelLabel, boxX + 6, boxY + 10, CHART_COLORS.thermalParcel, 'left', 'middle', '11px sans-serif');
      drawText(ctx, thermalIndexLabel, boxX + 6, boxY + 26, '#7c2d12', 'left', 'middle', 'bold 11px sans-serif');
    }
  }

  // ── Specific humidity isohume ────────────────────────────────────────────────
  {
    const p0 = hitResult.pressure;
    const cursorT = hitResult.temperature;

    const e = saturationVaporPressure(cursorT);
    const w = (EPS * e) / Math.max(p0 - e, 0.1);
    const q = w / (1 + w);

    if (isFinite(w) && w > 0) {
      const { pressureSamples, maxP } = layout;
      const pts: [number, number][] = [];
      const w_kg = w;
      for (const p of pressureSamples) {
        if (p >= p0 && p <= maxP) {
          const es = (w_kg * p) / (EPS + w_kg);
          if (es <= 0) continue;
          const tC = inverseSaturationVaporPressure(es);
          pts.push(tempPressureToCanvas(layout, tC, p));
        }
      }
      if (pts.length >= 2) {
        drawLine(ctx, pts, CHART_COLORS.isohume, 1.5, [4, 4], 0.9);
        const labelText = `q = ${(q * 1000).toFixed(1)} g/kg`;
        if (surfacePressure >= p0 && surfacePressure <= maxP) {
          const surfaceVaporPressure = (w_kg * surfacePressure) / (EPS + w_kg);
          if (surfaceVaporPressure > 0) {
            const surfaceTemperature = inverseSaturationVaporPressure(surfaceVaporPressure);
            const [lx] = tempPressureToCanvas(layout, surfaceTemperature, surfacePressure);
            axisLabels.push({ x: lx, text: labelText, atSurface: true });
          }
        } else {
          const [lx] = pts[pts.length - 1];
          axisLabels.push({ x: lx, text: labelText, atSurface: false });
        }
      }
    }
  }

  // ── Dynamic parcel trace ─────────────────────────────────────────────────────
  {
    const { minP, maxP, pressureSamples } = layout;
    const hoverP = hitResult.pressure;
    const hoverT = hitResult.temperature;

    // Dry adiabat: from hover level downward to x-axis (maxP)
    const thetaK = (hoverT + 273.15) * Math.pow(1000 / hoverP, RD / CP);
    const dryPts: [number, number][] = [];
    for (const p of pressureSamples) {
      if (p >= hoverP && p <= maxP) {
        const tC = thetaK * Math.pow(p / 1000, RD / CP) - 273.15;
        dryPts.push(tempPressureToCanvas(layout, tC, p));
      }
    }
    if (dryPts.length >= 2) {
      drawLine(ctx, dryPts, CHART_COLORS.dryAdiabat, 1.5, [6, 4]);
      const thetaC = thetaK - 273.15;
      const labelText = `θ = ${thetaC.toFixed(1)}°C`;
      if (surfacePressure >= hoverP && surfacePressure <= maxP) {
        const surfaceTemperature = thetaK * Math.pow(surfacePressure / 1000, RD / CP) - 273.15;
        const [lx] = tempPressureToCanvas(layout, surfaceTemperature, surfacePressure);
        axisLabels.push({ x: lx, text: labelText, atSurface: true });
      } else {
        const [lx] = dryPts[dryPts.length - 1];
        axisLabels.push({ x: lx, text: labelText, atSurface: false });
      }
    }

    // Moist adiabat: from hover level upward to top (minP)
    const moistPts: [number, number][] = [];
    let moistTemp = hoverT;
    let prevP = hoverP;
    for (const p of [...pressureSamples].reverse()) {
      if (p >= hoverP) continue;
      const dp = p - prevP;
      moistTemp += moistAdiabaticLapseRate(moistTemp, (p + prevP) / 2) * dp;
      moistPts.push(tempPressureToCanvas(layout, moistTemp, p));
      prevP = p;
      if (p <= minP) break;
    }
    if (moistPts.length >= 2) {
      drawLine(ctx, moistPts, CHART_COLORS.moistAdiabat, 1.5, [6, 4]);
    }
  }

  ctx.restore(); // plot clip

  // Draw labels at their computed positions (model surface or fallback)
  for (const lbl of axisLabels) {
    const ly = lbl.atSurface ? surfaceY : layout.plotTop + layout.plotHeight + 2;
    const lc = lbl.atSurface ? CHART_COLORS.skewtSurface : '#666';
    drawText(ctx, lbl.text, lbl.x, ly, lc, 'center', 'bottom', '9px sans-serif');
    if (lbl.atSurface) {
      ctx.save();
      ctx.fillStyle = CHART_COLORS.skewtSurface;
      ctx.beginPath();
      ctx.arc(lbl.x, ly, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore(); // initial save
}
export interface HitTestResult {
  pressure: number;
  heightMeters: number;
  temperature: number;
  dewpoint: number;
  windSpeed: number;
  windDirection: number;
  isInterpolated: boolean;
}

export type HitTestFn = (canvasX: number, canvasY: number) => HitTestResult | null;

export interface SkewTRenderResult {
  hitTest: HitTestFn;
  layout: PlotLayout;
}

export function renderSkewT(
  ctx: CanvasRenderingContext2D,
  skewTData: SkewTData,
  selectedTraceIndex: number,
  width: number,
  height: number
): SkewTRenderResult | null {
  const margin = { top: SKEWT_PLOT_TOP, right: 70, bottom: 50, left: 60 };
  const plotLeft = margin.left;
  const plotTop = margin.top;
  const plotWidth = Math.max(width - margin.left - margin.right, 100);
  const plotHeight = Math.max(height - margin.top - margin.bottom, 100);

  const trace = skewTData.traces[selectedTraceIndex] ?? skewTData.traces[0];
  if (!trace) return null;

  const layout = buildLayout(trace, skewTData.pressureLevels, plotLeft, plotTop, plotWidth, plotHeight);
  if (!layout) return null;

  drawGrid(ctx, layout);
  drawCloudCover(ctx, trace, layout);
  drawAxis(ctx, layout);
  drawThermalBuoyancy(ctx, trace, layout);
  drawModelSurfaceLine(ctx, trace.surfacePressure, skewTData.modelGridElevation, layout);
  drawTraces(ctx, trace, layout);
  drawThermalDiagnostics(ctx, trace, layout);
  drawAnnotations(ctx, trace, layout);

  const hitTest: HitTestFn = (cx, cy) => {
    if (cx < plotLeft || cx > plotLeft + plotWidth || cy < plotTop || cy > plotTop + plotHeight) return null;

    const yn = canvasToYNorm(cy, plotTop, plotHeight);
    const pressure = yNormToPressure(yn, layout.minP, layout.maxP);

    let nearestP = -1;
    let minDist = Infinity;
    for (const key of layout.levelByPressure.keys()) {
      const dist = Math.abs(key - pressure);
      if (dist < minDist) {
        minDist = dist;
        nearestP = key;
      }
    }
    if (nearestP === -1) return null;
    const levelData = layout.levelByPressure.get(nearestP);
    if (!levelData) return null;

    const sx = canvasToSkewX(layout, cx);
    const temp = sx - SKEW_OFFSET * (1 - yn);

    return {
      pressure: Math.round(pressure),
      heightMeters: levelData.heightMeters,
      temperature: temp,
      dewpoint: levelData.dewpoint,
      windSpeed: levelData.windSpeed,
      windDirection: levelData.windDirection,
      isInterpolated: levelData.isInterpolated,
    };
  };

  return { hitTest, layout };
}
