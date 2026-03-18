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

/** Returns the colour for the highest domain threshold that speed exceeds. */
export function windColorScale(speed: number): string {
  for (let i = windDomains.length - 1; i >= 0; i--) {
    if (speed >= windDomains[i]) return windColors[i];
  }
  return windColors[0];
}

/** Maps wind speed linearly to a stroke width in [0.75, 8]. */
export function strokeWidthScale(speed: number): number {
  return 0.75 + (Math.min(Math.max(speed, 0), windMaxSpeed) / windMaxSpeed) * (8 - 0.75);
}
