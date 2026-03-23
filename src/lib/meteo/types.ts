export interface PressureLevel {
  hPa: number;
  heightMeters: number;
}

export interface WindData {
  speed: number;
  direction: number;
}

export type MaxAltitude = 3000 | 4000 | 5000 | 6000 | 7000 | 8000;
