import type { PressureLevel, WindData } from './types';

export function getUComponent(speed: number, direction: number): number {
  return speed * Math.sin((direction * Math.PI) / 180);
}

export function getVComponent(speed: number, direction: number): number {
  return speed * Math.cos((direction * Math.PI) / 180);
}

export function interpolateWind(
  height: number,
  lower: PressureLevel,
  upper: PressureLevel,
  lowerWind: WindData,
  upperWind: WindData
): WindData {
  const ratio = (height - lower.heightMeters) / (upper.heightMeters - lower.heightMeters);

  // Interpolate speed linearly
  const speed = lowerWind.speed + (upperWind.speed - lowerWind.speed) * ratio;

  // Interpolate direction with special handling for angle wrap-around
  let dirDiff = upperWind.direction - lowerWind.direction;
  if (dirDiff > 180) dirDiff -= 360;
  if (dirDiff < -180) dirDiff += 360;
  const direction = (lowerWind.direction + dirDiff * ratio + 360) % 360;

  return { speed, direction };
}
