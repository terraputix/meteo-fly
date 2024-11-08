import * as d3 from 'd3';

export const windMaxSpeed = 80;
export const windDomains = [
    0,
    windMaxSpeed / 6,
    windMaxSpeed / 3,
    windMaxSpeed / 2,
    (2 * windMaxSpeed) / 3,
    (5 * windMaxSpeed) / 6,
    windMaxSpeed
];
export const windColors = [
    '#00FF00',
    '#7FFF00',
    '#FFA500',
    '#FFA500',
    '#FF4500',
    '#660066',
    '#000000'
];
export const windColorScale = d3
    .scalePow<string>()
    .domain(windDomains)
    .range(windColors);

export const strokeWidthScale = d3.scaleLinear().domain([0, windMaxSpeed]).range([0.75, 8]);
