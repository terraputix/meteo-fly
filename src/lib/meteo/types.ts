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

export interface ThermalLevelData {
  pressure: number;
  heightMeters: number;
  environmentTemperature: number;
  parcelTemperature: number;
  thermalIndex: number;
  triggerTemperature: number;
  isSurface: boolean;
}

export interface ThermalDiagnostics {
  levels: ThermalLevelData[];
  topHeightMeters: number | null;
  topHeightAglMeters: number | null;
  topPressure: number | null;
  topIsAboveProfile: boolean;
  minimumThermalIndex: number | null;
  triggerTemperature: number | null;
  reachesLcl: boolean | null;
}

export interface ThermalStrengthData {
  convectiveVelocityScale: number;
  boundaryLayerHeightAglMeters: number;
  surfaceBuoyancyFlux: number;
}

export interface SkewTTrace {
  time: Date;
  levels: SkewTLevelData[];
  lcl: number;
  lclHeightAglMeters: number;
  lclPressure: number | null;
  surfaceTemp: number;
  surfaceDewpoint: number;
  surfacePressure: number;
  thermal: ThermalDiagnostics;
  thermalStrength: ThermalStrengthData | null;
}

export interface SkewTData {
  traces: SkewTTrace[];
  modelGridElevation: number;
  timezone: string;
  timezoneAbbr: string;
  pressureLevels: number[];
  thermalTriggerTime: Date | null;
}
