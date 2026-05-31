export interface PressureLevel {
  hPa: number;
  heightMeters: number;
}

export interface WindData {
  speed: number;
  direction: number;
}

export type MaxAltitude = 3000 | 4000 | 5000 | 6000 | 7000 | 8000;

export interface SkewTLevelData {
  pressure: number;
  heightMeters: number;
  temperature: number;
  dewpoint: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  isNative: boolean;
  source: 'model' | 'interpolated';
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
