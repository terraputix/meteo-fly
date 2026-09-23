import {
  getChartHeight,
  getWindChartHeight,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  WIND_REFERENCE_ALTITUDE,
} from '$lib/charts/buildWindChartOption';
import { SKEWT_MARGIN } from '$lib/charts/skewTRenderer';
import type { MaxAltitude } from '$lib/meteo/types';

export const SKEWT_MIN_HEIGHT = 520;

export function getWindChartSize(availableWidth: number, availableHeight: number, maxAltitude: MaxAltitude) {
  const width = Math.max(0, Math.min(availableWidth, 960));
  const widePanelFactor = Math.max(0, Math.min(1, (width - 720) / 240));
  const highAltitudeFactor = Math.max(0, Math.min(1, (maxAltitude - WIND_REFERENCE_ALTITUDE) / 4000));
  const heightScale = 1 + 0.1 * widePanelFactor * highAltitudeFactor;
  const windHeight = Math.max(
    Math.ceil(getWindChartHeight(maxAltitude) * heightScale),
    Math.min(
      ((width - MARGIN_LEFT - MARGIN_RIGHT) / 2) * (maxAltitude / WIND_REFERENCE_ALTITUDE) * heightScale,
      availableHeight - getChartHeight(0)
    )
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
