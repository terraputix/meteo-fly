import type { SkewTLevelData } from '$lib/meteo/types';
import type { TooltipStore } from '$lib/charts/tooltipFormatter';

export interface WindChartSelection {
  timeIndex: number;
  heightIndex: number;
  timestamp: number;
  height: number | null;
}

export interface SkewTChartSelection {
  pressure: number;
  heightMeters: number;
  temperature: number;
  traceTemperature: number;
  dewpoint: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  isInterpolated: boolean;
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

export function findNearestIndex(sortedValues: number[], value: number): number {
  if (sortedValues.length === 0) return 0;

  let nearestIndex = 0;
  let nearestDistance = Math.abs(sortedValues[0] - value);
  for (let index = 1; index < sortedValues.length; index++) {
    const distance = Math.abs(sortedValues[index] - value);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }
  return nearestIndex;
}

export function createWindChartSelection(
  store: TooltipStore,
  timeIndex: number,
  heightIndex: number
): WindChartSelection | null {
  if (store.sortedWindTimes.length === 0) return null;

  const nextTimeIndex = clampIndex(timeIndex, store.sortedWindTimes.length);
  const nextHeightIndex = clampIndex(heightIndex, store.sortedWindHeights.length);
  const timestamp = store.sortedWindTimes[nextTimeIndex];
  const height = store.sortedWindHeights[nextHeightIndex] ?? null;

  return {
    timeIndex: nextTimeIndex,
    heightIndex: nextHeightIndex,
    timestamp,
    height,
  };
}

export function createSkewTLevelSelection(level: SkewTLevelData): SkewTChartSelection {
  return {
    pressure: level.pressure,
    heightMeters: level.heightMeters,
    temperature: level.temperature,
    traceTemperature: level.temperature,
    dewpoint: level.dewpoint,
    windSpeed: level.windSpeed,
    windDirection: level.windDirection,
    cloudCover: level.cloudCover,
    isInterpolated: level.isInterpolated,
  };
}
