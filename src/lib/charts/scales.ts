import * as d3 from 'd3';

const maxSpeed = 40;
export const colorScale = d3
    .scaleLinear<string>()
    .domain([0, maxSpeed / 2, maxSpeed])
    .range(['#00FF00', '#FFA500', '#FF0000']);

export const strokeWidthScale = d3.scaleLinear().domain([0, maxSpeed]).range([0.5, 6]);
