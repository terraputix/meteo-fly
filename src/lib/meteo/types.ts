export interface PressureLevel {
  hPa: number;
  heightMeters: number;
}

export interface WindData {
  speed: number;
  direction: number;
}

export const MAX_ALTITUDE_OPTIONS = [
  { value: 3000, label: '3000m (700hPa)' },
  { value: 4000, label: '4000m (625hPa)' },
  { value: 5000, label: '5000m (550hPa)' },
  { value: 6000, label: '6000m (475hPa)' },
  { value: 7000, label: '7000m (400hPa)' },
  { value: 8000, label: '8000m (350hPa)' },
  { value: 10000, label: '10000m (250hPa)' },
] as const;

export type MaxAltitude = (typeof MAX_ALTITUDE_OPTIONS)[number]['value'];

export interface SkewTLevelData {
  pressure: number;
  heightMeters: number;
  temperature: number;
  dewpoint: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  isInterpolated: boolean;
}

export interface SkewTTrace {
  time: Date;
  levels: SkewTLevelData[];
  lcl: number;
  surfaceTemp: number;
  surfaceDewpoint: number;
}

export interface SkewTData {
  traces: SkewTTrace[];
  elevation: number;
  modelGridElevation?: number;
  timezoneAbbr: string;
  pressureLevels: number[];
}
