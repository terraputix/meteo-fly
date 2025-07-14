import { scalePow, scaleLinear } from 'd3';
import { type ScaleOptions } from '@observablehq/plot';
export const windMaxSpeed = 80;
export const windDomains = [
  0,
  windMaxSpeed / 6,
  windMaxSpeed / 3,
  windMaxSpeed / 2,
  (2 * windMaxSpeed) / 3,
  (5 * windMaxSpeed) / 6,
  windMaxSpeed,
];
export const windColors = ['#00FF00', '#7FFF00', '#FFA500', '#FFA500', '#FF4500', '#660066', '#000000'];
export const windColorScale = scalePow<string>().domain(windDomains).range(windColors);

export const strokeWidthScale = scaleLinear().domain([0, windMaxSpeed]).range([0.75, 8]);

export const windSpeedScaleOptions: ScaleOptions = {
  domain: windDomains,
  range: windColors,
  type: 'pow',
  label: 'Wind Speed (km/h)',
};

export const cloudCoverScaleOptions: ScaleOptions = {
  domain: [0, 100],
  range: ['white', 'gray'],
  type: 'sequential',
  label: 'Cloud Cover (%)',
};
