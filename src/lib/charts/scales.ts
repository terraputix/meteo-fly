export const windMaxSpeed = 80;

// One color per evenly-spaced threshold: 0, 1/6, 2/6, … 6/6 of windMaxSpeed.
export const windColors = ['#00FF00', '#7FFF00', '#FFA500', '#FFA500', '#FF4500', '#660066', '#000000'];

const step = windMaxSpeed / (windColors.length - 1);

/** Returns the colour for the highest threshold that speed meets or exceeds. */
export function windColorScale(speed: number): string {
  const i = Math.min(Math.floor(speed / step), windColors.length - 1);
  return windColors[Math.max(i, 0)];
}

/** Maps wind speed linearly to a stroke width in [0.75, 8]. */
export function strokeWidthScale(speed: number): number {
  return 0.75 + (Math.min(Math.max(speed, 0), windMaxSpeed) / windMaxSpeed) * (8 - 0.75);
}
