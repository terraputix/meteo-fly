import { CHART_COLORS as colors } from '#lib/charts/chartColors.js';
import { windColorScale, strokeWidthScale } from '#lib/charts/scales.js';
import { metersToHPaExact } from '#lib/meteo/pressureLevels.js';
import { fmtTime } from '#lib/helpers.js';
import {
  curveControls,
  rainDropCount,
  windRotation,
  DAYLIGHT_CONTEXT_TOP,
  RAIN_TOP,
  RAIN_HEIGHT_PX,
  TEMP_TOP,
  TEMP_HEIGHT_PX,
  WIND_ARROW_POINTS,
  type ChartPoint,
  type PreparedWindChart,
  type WindChartLayout,
} from '#lib/charts/windChartLayout.js';

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
  dash: number[] = []
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  align: CanvasTextAlign = 'left',
  color = '#666',
  size = 11,
  bold = false
) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

export function drawSmoothLine(
  ctx: CanvasRenderingContext2D,
  points: ChartPoint[],
  color: string,
  dash: number[] = []
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dash);
  ctx.beginPath();
  let start = 0;
  while (start < points.length) {
    if (!points[start].every(Number.isFinite)) {
      start++;
      continue;
    }
    let end = start + 1;
    while (end < points.length && points[end].every(Number.isFinite)) end++;
    ctx.moveTo(...points[start]);
    for (let i = start; i < end - 1; i++) {
      const [a, b] = curveControls(
        points[Math.max(start, i - 1)],
        points[i],
        points[i + 1],
        points[Math.min(end - 1, i + 2)]
      );
      ctx.bezierCurveTo(...a, ...b, ...points[i + 1]);
    }
    start = end;
  }
  ctx.stroke();
}

function clipPanel(ctx: CanvasRenderingContext2D, layout: WindChartLayout, panel: number, draw: () => void) {
  const bounds = layout.panels[panel];
  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.left, bounds.top, layout.plotWidth, bounds.height);
  ctx.clip();
  draw();
  ctx.restore();
}

function daylightMarker(ctx: CanvasRenderingContext2D, x: number, y: number, sunrise: boolean) {
  ctx.save();
  ctx.translate(x - 6.5, y - 6.5);
  ctx.scale(13 / 24, 13 / 24);
  ctx.strokeStyle = colors.daylightMarker;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(2, 22);
  ctx.lineTo(22, 22);
  ctx.moveTo(8, 18);
  ctx.arc(12, 18, 4, Math.PI, 0);
  ctx.moveTo(2, 18);
  ctx.lineTo(4, 18);
  ctx.moveTo(20, 18);
  ctx.lineTo(22, 18);
  ctx.moveTo(5, 11);
  ctx.lineTo(6.4, 12.4);
  ctx.moveTo(19, 11);
  ctx.lineTo(17.6, 12.4);
  ctx.moveTo(12, 2);
  ctx.lineTo(12, 10);
  ctx.moveTo(8, 6);
  ctx.lineTo(12, sunrise ? 2 : 10);
  ctx.lineTo(16, 6);
  ctx.stroke();
  ctx.restore();
}

export type WindAxisUnit = 'm' | 'hPa';

export function renderWindChart(
  ctx: CanvasRenderingContext2D,
  data: PreparedWindChart,
  layout: WindChartLayout,
  axisUnit: WindAxisUnit = 'm'
) {
  const { left, right, x, pressureY, temperatureY, humidityY } = layout;
  ctx.save();
  ctx.clearRect(0, 0, layout.width, layout.height);
  if (layout.plotWidth <= 0) {
    ctx.restore();
    return;
  }
  const temperature = data.temperatureChartData;

  clipPanel(ctx, layout, 0, () => {
    const sunrise = x(+temperature.sunrise);
    const sunset = x(+temperature.sunset);
    if (Number.isFinite(sunrise) && Number.isFinite(sunset)) {
      ctx.fillStyle = colors.sunriseFill;
      ctx.fillRect(sunrise, TEMP_TOP, sunset - sunrise, TEMP_HEIGHT_PX);
    }
    for (let t = layout.tempMin; t <= layout.tempMax; t += 5)
      line(ctx, left, temperatureY(t), right, temperatureY(t), colors.gridLine);
    drawSmoothLine(
      ctx,
      temperature.temperatureData.map((d) => [x(+d.time), temperatureY(d.value)]),
      colors.temperature
    );
    drawSmoothLine(
      ctx,
      temperature.dewpointData.map((d) => [x(+d.time), temperatureY(d.value)]),
      colors.dewpoint
    );
    drawSmoothLine(
      ctx,
      temperature.humidityData.map((d) => [x(+d.time), humidityY(d.value)]),
      colors.humidity,
      [5, 3]
    );
  });
  for (let t = layout.tempMin; t <= layout.tempMax; t += 5) text(ctx, `${t}`, left - 18, temperatureY(t), 'right');
  for (let h = 0; h <= 100; h += 25) text(ctx, `${h}`, right + 3, humidityY(h));
  text(ctx, '°C', left - 10, TEMP_TOP - 5);
  text(ctx, '%', right - 3, TEMP_TOP, 'right');
  for (const [time, sunrise] of [
    [temperature.sunrise, true],
    [temperature.sunset, false],
  ] as const) {
    const px = x(+time);
    if (!Number.isFinite(px) || px < left || px > right) continue;
    daylightMarker(ctx, px + (sunrise ? -7 : 7), DAYLIGHT_CONTEXT_TOP + 15, sunrise);
    text(
      ctx,
      fmtTime(time, data.timezone),
      px + (sunrise ? 4 : -4),
      DAYLIGHT_CONTEXT_TOP + 19,
      sunrise ? 'left' : 'right',
      colors.daylightMarker,
      10,
      true
    );
  }

  clipPanel(ctx, layout, 1, () => {
    for (const rect of data.rainCloudChartData.cloudRects) {
      if (!Number.isFinite(rect.cloudCover)) continue;
      ctx.fillStyle = `${colors.cloudRect}${Math.max(0, Math.min(1, rect.cloudCover / 100))})`;
      ctx.fillRect(
        x(+rect.x1),
        RAIN_TOP + (1 - rect.y2) * RAIN_HEIGHT_PX,
        x(+rect.x2) - x(+rect.x1),
        (rect.y2 - rect.y1) * RAIN_HEIGHT_PX
      );
    }
    for (let i = 0; i < 3; i++)
      line(ctx, left, RAIN_TOP + (i * RAIN_HEIGHT_PX) / 3, right, RAIN_TOP + (i * RAIN_HEIGHT_PX) / 3, colors.gridLine);
    ctx.fillStyle = colors.rain;
    for (const dot of data.rainCloudChartData.rainDots) {
      for (let i = 0; i < rainDropCount(dot.rain); i++) {
        ctx.save();
        ctx.translate(x(+dot.time), RAIN_TOP + (1 - (i + 0.5) / 3) * RAIN_HEIGHT_PX);
        ctx.scale(0.8, 0.8);
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.bezierCurveTo(3.5, -3.5, 5, 0.5, 5, 3);
        ctx.arc(0, 3, 5, 0, Math.PI);
        ctx.bezierCurveTo(-5, 0.5, -3.5, -3.5, 0, -7);
        ctx.fill();
        ctx.restore();
      }
    }
  });
  ['High ☁️', 'Mid ☁️', 'Low ☁️'].forEach((label, i) =>
    text(ctx, label, left - 10, RAIN_TOP + ((i + 0.5) * RAIN_HEIGHT_PX) / 3, 'right', '#999', 10)
  );

  clipPanel(ctx, layout, 2, () => {
    if (axisUnit === 'm') {
      for (let altitude = 0; altitude <= layout.maxAltitude; altitude += 500) {
        const y = pressureY(metersToHPaExact(altitude));
        line(ctx, left, y, right, y, colors.gridLine);
      }
    }
    for (const cloud of data.cloudData) {
      const band = layout.bands.get(cloud.pressure);
      if (!band || !Number.isFinite(cloud.value) || cloud.value <= 0) continue;
      ctx.fillStyle = `${colors.windCloud}${(0.85 * Math.min(100, cloud.value)) / 100})`;
      const x1 = x(+cloud.time - 1_800_000);
      const x2 = x(+cloud.time + 1_800_000);
      ctx.fillRect(x1 - 0.5, pressureY(band.top), x2 - x1 + 1, pressureY(band.bottom) - pressureY(band.top));
    }
    if (axisUnit === 'hPa') {
      for (const level of layout.nativeLevels) {
        const y = pressureY(level.hPa);
        line(ctx, left, y, right, y, 'rgba(160,160,160,0.35)', 0.8, [4, 3]);
      }
    }
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const wind of data.windData) {
      if (![+wind.time, wind.pressure, wind.speed, wind.direction].every(Number.isFinite)) continue;
      const arrowX = x(+wind.time);
      const arrowY = pressureY(wind.pressure);
      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(windRotation(wind.direction));
      ctx.strokeStyle = windColorScale(wind.speed);
      ctx.lineWidth = strokeWidthScale(wind.speed);
      ctx.globalAlpha = wind.source === 'interpolated' ? 0.4 : 1;
      ctx.beginPath();
      ctx.moveTo(...WIND_ARROW_POINTS[0]);
      for (let i = 1; i < WIND_ARROW_POINTS.length; i++) ctx.lineTo(...WIND_ARROW_POINTS[i]);
      ctx.stroke();
      ctx.restore();
    }
    drawSmoothLine(ctx, layout.lclPoints, colors.lcl);
    const windPanel = layout.panels[2];
    const labelHeight = 12;
    const labelGap = 2;
    const labelOffset = labelHeight / 2 + labelGap;
    const labelSeparation = labelHeight + labelGap;
    const minLabelY = windPanel.top + labelHeight / 2;
    const maxLabelY = windPanel.top + windPanel.height - labelHeight / 2;
    ctx.font = '9px sans-serif';
    const annotations = [
      { value: data.elevation, label: 'DEM', color: colors.elevation, dash: [6, 4], alignRight: false },
      {
        value: data.modelGridElevation,
        label: 'Model grid',
        color: colors.modelGridElevation,
        dash: [2, 3],
        alignRight: true,
      },
    ].flatMap((annotation) => {
      if (annotation.value == null || !Number.isFinite(annotation.value)) return [];
      const y = pressureY(metersToHPaExact(annotation.value));
      if (y < windPanel.top || y > windPanel.top + windPanel.height) return [];
      const label = `${annotation.label} ${annotation.value}m`;
      const width = ctx.measureText(label).width;
      return [
        {
          ...annotation,
          label,
          y,
          labelY: Math.min(maxLabelY, y - labelOffset < minLabelY ? y + labelOffset : y - labelOffset),
          x: annotation.alignRight ? right - 3 - width : left + 3,
        },
      ];
    });
    const [dem, modelGrid] = annotations;
    if (
      dem &&
      modelGrid &&
      (Math.abs(dem.y - modelGrid.y) < labelSeparation || Math.abs(dem.labelY - modelGrid.labelY) < labelSeparation)
    ) {
      const [upper, lower] = dem.y <= modelGrid.y ? [dem, modelGrid] : [modelGrid, dem];
      upper.labelY = upper.y - labelOffset;
      lower.labelY = lower.y + labelOffset;
      if (upper.labelY < minLabelY) {
        upper.labelY = lower.y + labelOffset;
        lower.labelY = upper.labelY + labelSeparation;
      } else if (lower.labelY > maxLabelY) {
        lower.labelY = upper.y - labelOffset;
        upper.labelY = lower.labelY - labelSeparation;
      }
    }
    for (const annotation of annotations) {
      line(ctx, left, annotation.y, right, annotation.y, annotation.color, 2, annotation.dash);
    }
    for (const annotation of annotations) {
      if (annotation.labelY !== annotation.y - labelOffset) {
        const anchorX = annotation.alignRight ? right - 1 : left + 1;
        line(ctx, anchorX, annotation.y, anchorX, annotation.labelY, annotation.color);
      }
      text(ctx, annotation.label, annotation.x, annotation.labelY, 'left', annotation.color, 9);
    }
  });
  if (axisUnit === 'm') {
    for (let altitude = 0; altitude < layout.maxAltitude; altitude += 500)
      text(ctx, `${altitude}m`, left - 8, pressureY(metersToHPaExact(altitude)), 'right', '#666', 10);
  } else {
    for (const level of layout.nativeLevels)
      text(ctx, `${level.hPa}hPa`, left - 8, pressureY(level.hPa), 'right', '#666', 9);
  }
  const wind = layout.panels[2];
  const windBottom = wind.top + wind.height;
  line(ctx, left, wind.top - WIND_ARROW_POINTS, left, windBottom, colors.axisLine);
  line(ctx, right, wind.top - WIND_ARROW_POINTS, right, windBottom, colors.axisLine);
  for (const [index, panel] of layout.panels.entries()) {
    const bottom = index === 2 ? windBottom : panel.top + panel.height;
    line(ctx, left, bottom, right, bottom, colors.axisLine);
  }
  for (const time of layout.timeTicks) {
    const y = windBottom;
    line(ctx, x(time), y, x(time), y + 5, colors.axisLine);
    text(ctx, fmtTime(new Date(time), data.timezone), x(time), y + 14, 'center');
  }
  text(ctx, `Time [${data.timezoneAbbr}]`, (left + right) / 2, windBottom + 32, 'center');
  ctx.restore();
}

export function renderWindChartOverlay(
  ctx: CanvasRenderingContext2D,
  layout: WindChartLayout,
  time: number,
  panel: number,
  y: number
) {
  ctx.save();
  ctx.clearRect(0, 0, layout.width, layout.height);
  for (const bounds of layout.panels)
    line(ctx, layout.x(time), bounds.top, layout.x(time), bounds.top + bounds.height, '#999', 1, [4, 3]);
  const bounds = layout.panels[panel];
  if (y >= bounds.top && y <= bounds.top + bounds.height) line(ctx, layout.left, y, layout.right, y, '#999', 1, [4, 3]);
  ctx.restore();
}
