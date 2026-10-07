const CLOUD_RGB = [100, 120, 145] as const;

export const WIND_CLOUD_EDGE_ALPHA = 13;
export const WIND_CLOUD_BANDS = [
  { minimum: 5, alpha: 51 },
  { minimum: 25, alpha: 89 },
  { minimum: 50, alpha: 128 },
  { minimum: 75, alpha: 179 },
] as const;

/**
 * Shared color constants.
 */
export const CHART_COLORS = {
  temperature: '#e53e3e',
  dewpoint: '#276749',
  humidity: '#3182ce',
  lcl: '#805ad5',
  elevation: '#8B4513',
  modelGridElevation: '#556B2F',
  rain: 'rgba(30,100,220,0.80)',
  cloudRect: `rgba(${CLOUD_RGB.join(',')},`,
  windCloudRgb: CLOUD_RGB,
  skewtElevation: '#A0785C',
  dryAdiabat: '#9f6628',
  moistAdiabat: '#2c9dfa',
  isohume: '#569f28',
  axisLine: '#ccc',
  gridLine: '#eee',
  sunriseFill: 'rgba(255,220,0,0.18)',
  daylightMarker: '#b7791f',
} as const;
