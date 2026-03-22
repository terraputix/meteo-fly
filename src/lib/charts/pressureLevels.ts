import type { VerticalProfile, VerticalProfileKey } from '$lib/api/types';
import type { PressureLevel } from '$lib/meteo/types';

export function getAtLevel(data: VerticalProfile, pressure: number): Float32Array | undefined {
  const key = `_${pressure}hPa` as VerticalProfileKey;
  return data[key];
}

export const modelPressureLevels: PressureLevel[] = [
  { hPa: 1000, heightMeters: 110 },
  { hPa: 975, heightMeters: 320 },
  { hPa: 950, heightMeters: 540 },
  { hPa: 925, heightMeters: 770 },
  { hPa: 900, heightMeters: 1000 },
  { hPa: 850, heightMeters: 1500 },
  { hPa: 800, heightMeters: 1900 },
  { hPa: 700, heightMeters: 3000 },
  { hPa: 600, heightMeters: 4200 },
  { hPa: 500, heightMeters: 5600 },
  { hPa: 400, heightMeters: 7200 },
  { hPa: 300, heightMeters: 9200 },
];

export function getModelPressureLevelsForAltitude(maxAltitude: number): PressureLevel[] {
  return modelPressureLevels.filter((level) => level.heightMeters <= maxAltitude);
}

function interpolatePressure(lowerLevel: PressureLevel, upperLevel: PressureLevel, heightMeters: number): number {
  const altitudeSpan = upperLevel.heightMeters - lowerLevel.heightMeters;
  if (altitudeSpan <= 0) return lowerLevel.hPa;

  const ratio = (heightMeters - lowerLevel.heightMeters) / altitudeSpan;
  const interpolatedHpa = lowerLevel.hPa + (upperLevel.hPa - lowerLevel.hPa) * ratio;

  return Math.round(interpolatedHpa);
}

function createInterpolatedLevels(
  lowerLevel: PressureLevel,
  upperLevel: PressureLevel,
  heights: number[]
): PressureLevel[] {
  return heights.map((heightMeters) => ({
    hPa: interpolatePressure(lowerLevel, upperLevel, heightMeters),
    heightMeters,
  }));
}

export const interpolatedPressureLevels: PressureLevel[] = [
  ...createInterpolatedLevels(modelPressureLevels[4], modelPressureLevels[5], [1250]),
  ...createInterpolatedLevels(modelPressureLevels[5], modelPressureLevels[6], [1750]),
  ...createInterpolatedLevels(modelPressureLevels[6], modelPressureLevels[7], [2250, 2500, 2750]),
  ...createInterpolatedLevels(modelPressureLevels[7], modelPressureLevels[8], [3250, 3500, 3750, 4000]),
  ...createInterpolatedLevels(modelPressureLevels[8], modelPressureLevels[9], [4500, 4750, 5000, 5250, 5500]),
  ...createInterpolatedLevels(modelPressureLevels[9], modelPressureLevels[10], [5750, 6000, 6250, 6500, 6750, 7000]),
];

export function getInterpolatedPressureLevelsForAltitude(maxAltitude: number): PressureLevel[] {
  return interpolatedPressureLevels.filter((level) => level.heightMeters <= maxAltitude);
}

export function getAllPressureLevelsForAltitude(maxAltitude: number): PressureLevel[] {
  return [
    ...getModelPressureLevelsForAltitude(maxAltitude),
    ...getInterpolatedPressureLevelsForAltitude(maxAltitude),
  ].sort((a, b) => a.heightMeters - b.heightMeters);
}
