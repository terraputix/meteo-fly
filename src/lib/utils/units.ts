export const UNIT_OPTIONS = {
  wind: ['km/h', 'mph', 'kt', 'm/s'],
  temperature: ['°C', '°F'],
  altitude: ['m', 'ft'],
  rain: ['mm', 'in'],
} as const;

export type UnitPreferences = { [K in keyof typeof UNIT_OPTIONS]: (typeof UNIT_OPTIONS)[K][number] };
export const METRIC_UNITS: UnitPreferences = { wind: 'km/h', temperature: '°C', altitude: 'm', rain: 'mm' };
export const IMPERIAL_UNITS: UnitPreferences = { wind: 'mph', temperature: '°F', altitude: 'ft', rain: 'in' };

export function parseUnits(value: unknown): UnitPreferences {
  const result = { ...METRIC_UNITS };
  if (!value || typeof value !== 'object') return result;
  for (const key of Object.keys(UNIT_OPTIONS) as (keyof UnitPreferences)[]) {
    const unit = Reflect.get(value, key);
    if (UNIT_OPTIONS[key].some((option) => option === unit)) Object.assign(result, { [key]: unit });
  }
  return result;
}

export function windSpeed(value: number, units: UnitPreferences): number {
  return value / { 'km/h': 1, mph: 1.609344, kt: 1.852, 'm/s': 3.6 }[units.wind];
}
export function temperature(value: number, units: UnitPreferences): number {
  return units.temperature === '°F' ? value * 1.8 + 32 : value;
}
export function altitude(value: number, units: UnitPreferences): number {
  return units.altitude === 'ft' ? value / 0.3048 : value;
}
export function rain(value: number, units: UnitPreferences): number {
  return units.rain === 'in' ? value / 25.4 : value;
}
export function formatAltitude(value: number, units: UnitPreferences): string {
  return `${Math.round(altitude(value, units))} ${units.altitude}`;
}
