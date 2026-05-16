import type { WeatherDataType } from '$lib/api/types';

/**
 * Calculates the Lifting Condensation Level (LCL) height using Espy's equation
 * @param temperature Temperature in degrees Celsius
 * @param dewpoint Dewpoint temperature in degrees Celsius
 * @returns Height of LCL in meters
 */
function calculateLcl(temperature: number, dewpoint: number): number {
  // Input validation
  if (isNaN(temperature) || isNaN(dewpoint)) {
    throw new Error('Temperature and dewpoint must be valid numbers');
  }

  if (dewpoint > temperature) {
    console.log('Dewpoint cannot be higher than temperature');
    console.log('Dewpoint:', dewpoint);
    console.log('Temperature:', temperature);
    return 0;
  }

  // Espy's equation: LCL ≈ 125 * (T - Td) meters
  const lclHeight = 125 * (temperature - dewpoint);

  return Math.round(lclHeight);
}

export function calculateLclWeather(data: WeatherDataType): { time: Date; value: number }[] {
  const lcls: { time: Date; value: number }[] = [];

  const times = data.hourly.time;
  const temperatures = data.hourly.temperature_2m;
  const dewpoints = data.hourly.dewpoint_2m;

  for (let i = 0; i < times.length; i++) {
    const temperature = temperatures[i];
    const dewpoint = dewpoints[i];

    const lcl = calculateLcl(temperature, dewpoint);
    lcls.push({ time: times[i], value: lcl + data.elevation });
  }

  return lcls;
}
