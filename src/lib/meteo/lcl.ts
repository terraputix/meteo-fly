import type { WindChartData } from '$lib/api/types';

export interface LclPoint {
  time: Date;
  value: number | null;
}

/**
 * Calculates the Lifting Condensation Level (LCL) height using Espy's equation
 * @param temperature Temperature in degrees Celsius
 * @param dewpoint Dewpoint temperature in degrees Celsius
 * @returns Height of LCL in meters
 */
export function calculateLcl(temperature: number, dewpoint: number): number {
  if (!Number.isFinite(temperature) || !Number.isFinite(dewpoint)) return NaN;

  if (dewpoint > temperature) {
    return 0;
  }

  // Espy's equation: LCL ≈ 125 * (T - Td) meters
  const lclHeight = 125 * (temperature - dewpoint);

  return Math.round(lclHeight);
}

export function calculateLclWeather(data: WindChartData): LclPoint[] {
  const lcls: LclPoint[] = [];

  const times = data.hourly.time;
  const temperatures = data.hourly.temperature_2m;
  const dewpoints = data.hourly.dewpoint_2m;

  for (let i = 0; i < times.length; i++) {
    const temperature = temperatures[i];
    const dewpoint = dewpoints[i];

    const lcl = calculateLcl(temperature, dewpoint);
    const value = lcl + data.elevation;
    lcls.push({ time: times[i], value: Number.isFinite(value) ? value : null });
  }

  return lcls;
}
