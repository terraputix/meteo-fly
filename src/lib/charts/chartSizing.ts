import {
  getChartHeight,
  getWindChartHeight,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  WIND_REFERENCE_ALTITUDE,
} from '#lib/charts/windChartLayout.js';
import { SKEWT_MARGIN } from '#lib/charts/skewTRenderer.js';
import type { MaxAltitude } from '#lib/meteo/types.js';

export const SKEWT_MIN_HEIGHT = 520;

export function getWindChartSize(availableWidth: number, availableHeight: number, maxAltitude: MaxAltitude) {
  const width = Math.max(0, Math.min(availableWidth, 960));
  const minimumWindHeight = getWindChartHeight(maxAltitude);
  const heightScale =
    maxAltitude <= WIND_REFERENCE_ALTITUDE
      ? maxAltitude / WIND_REFERENCE_ALTITUDE
      : minimumWindHeight / getWindChartHeight(WIND_REFERENCE_ALTITUDE);
  const windHeight = Math.max(
    minimumWindHeight,
    Math.min(((width - MARGIN_LEFT - MARGIN_RIGHT) / 2) * heightScale, availableHeight - getChartHeight(0))
  );
  return { width, height: getChartHeight(windHeight) };
}

export function getSkewTChartSize(availableWidth: number, availableHeight: number) {
  const horizontalMargins = SKEWT_MARGIN.left + SKEWT_MARGIN.right;
  const verticalMargins = SKEWT_MARGIN.top + SKEWT_MARGIN.bottom;
  const plotSize = Math.max(
    SKEWT_MIN_HEIGHT - verticalMargins,
    Math.min(availableWidth - horizontalMargins, availableHeight - verticalMargins, 850 - horizontalMargins)
  );
  return {
    width: Math.max(0, Math.min(availableWidth, plotSize + horizontalMargins)),
    height: plotSize + verticalMargins,
  };
}
