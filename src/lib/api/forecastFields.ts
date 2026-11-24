import { MODEL_NATIVE_LEVELS } from '#lib/meteo/pressureLevels.js';
import { formatAltitude, type UnitPreferences } from '#lib/utils/units.js';

export const WIND_COMPARISON_HEIGHTS = ['10m', '80m', '120m', '180m'] as const;
export const DEFAULT_WIND_COMPARISON_LEVEL = WIND_COMPARISON_HEIGHTS[0];
export const WIND_COMPARISON_PRESSURES = [
  ...new Set(Object.values(MODEL_NATIVE_LEVELS).flatMap((levels) => levels.map(({ hPa }) => hPa))),
]
  .sort((a, b) => b - a)
  .map((hPa) => `${hPa}hPa` as const);

export type WindComparisonLevel = (typeof WIND_COMPARISON_HEIGHTS)[number] | `${number}hPa`;

export function parseWindComparisonLevel(value: string | null): WindComparisonLevel | undefined {
  return (
    WIND_COMPARISON_HEIGHTS.find((height) => height === value) ??
    WIND_COMPARISON_PRESSURES.find((pressure) => pressure === value)
  );
}

export function windComparisonFields(level: WindComparisonLevel): string[] {
  const fields = [`wind_speed_${level}`, `wind_direction_${level}`];
  if (level === DEFAULT_WIND_COMPARISON_LEVEL) fields.push('wind_gusts_10m');
  return fields;
}

export function formatWindComparisonLevel(level: WindComparisonLevel, units: UnitPreferences): string {
  const value = Number.parseInt(level, 10);
  return level.endsWith('m') ? formatAltitude(value, units) : `${value} hPa`;
}
