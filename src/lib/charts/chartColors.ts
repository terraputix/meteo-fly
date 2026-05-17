/**
 * Shared color constants used by both the ECharts option builder and the legend template.
 * Define them once here so they stay in sync.
 */
export const CHART_COLORS = {
  temperature: '#e53e3e',
  dewpoint: '#276749',
  humidity: '#3182ce',
  lcl: '#805ad5',
  elevation: '#8B4513',
  rain: 'rgba(30,100,220,0.80)',
  cloudRect: 'rgba(100,120,145,',
  windCloud: 'rgba(90,110,140',
  axisLine: '#ccc',
  gridLine: '#eee',
  sunriseFill: 'rgba(255,220,0,0.18)',
} as const;

/** Legend items that drive both the option builder and the Svelte legend template. */
export interface LegendItem {
  label: string;
  color: string;
  style: 'solid' | 'dashed' | 'emoji';
  emoji?: string;
}

export const LEGEND_ITEMS: LegendItem[] = [
  { label: 'Temperature', color: CHART_COLORS.temperature, style: 'solid' },
  { label: 'Dewpoint', color: CHART_COLORS.dewpoint, style: 'solid' },
  { label: 'Humidity', color: CHART_COLORS.humidity, style: 'dashed' },
  { label: 'LCL', color: CHART_COLORS.lcl, style: 'solid' },
  { label: 'Surface Elev.', color: CHART_COLORS.elevation, style: 'dashed' },
  { label: 'Rain', color: '', style: 'emoji', emoji: '💧' },
];
