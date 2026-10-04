import type { PressureLevel, WindData } from './types';

const COMPASS_DIRECTIONS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

export function windDirectionLabel(direction: number): string {
  if (!Number.isFinite(direction)) return '—';
  const degrees = ((direction % 360) + 360) % 360;
  return COMPASS_DIRECTIONS[Math.round(degrees / 22.5) % COMPASS_DIRECTIONS.length];
}

export function interpolateWind(
  height: number,
  lower: PressureLevel,
  upper: PressureLevel,
  lowerWind: WindData,
  upperWind: WindData,
  actualLowerH?: number,
  actualUpperH?: number
): WindData {
  const lh = actualLowerH ?? lower.heightMeters;
  const uh = actualUpperH ?? upper.heightMeters;
  const ratio = (height - lh) / (uh - lh);

  // Interpolate speed linearly
  const speed = lowerWind.speed + (upperWind.speed - lowerWind.speed) * ratio;

  // Interpolate direction with special handling for angle wrap-around
  let dirDiff = upperWind.direction - lowerWind.direction;
  if (dirDiff > 180) dirDiff -= 360;
  if (dirDiff < -180) dirDiff += 360;
  const direction = (lowerWind.direction + dirDiff * ratio + 360) % 360;

  return { speed, direction };
}
