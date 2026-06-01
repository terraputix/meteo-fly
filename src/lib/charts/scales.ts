export const windMaxSpeed = 80;

/**
 * A 16-color wind speed scale.
 * 0-5 km/h: Light Cyan
 * 5-20 km/h: Gradient of Greens
 * 20-25 km/h: Lime/Yellow-Green transition
 * 25 km/h+: Yellow through Orange, Red, and Purple
 */
export const windColors = [
  '#B2EBF2', // 0-5 km/h: Lightest Blue/Cyan
  '#A1D99B', // 5-10 km/h: Very Light Green
  '#74C476', // 10-15 km/h: Light Green
  '#41AB5D', // 15-20 km/h: Medium Green
  '#D4E157', // 20-25 km/h: Lime Green (Yellowish transition)
  '#FFEE58', // 25-30 km/h: Yellow
  '#FFD54F', // 30-35 km/h: Amber
  '#FFB74D', // 35-40 km/h: Light Orange
  '#FF9800', // 40-45 km/h: Orange
  '#F57C00', // 45-50 km/h: Dark Orange
  '#E64A19', // 50-55 km/h: Deep Orange
  '#F44336', // 55-60 km/h: Red
  '#D32F2F', // 60-65 km/h: Dark Red
  '#C2185B', // 65-70 km/h: Pink/Magenta
  '#8E24AA', // 70-75 km/h: Purple
  '#4A148C', // 75-80+ km/h: Deep Violet
];

const step = windMaxSpeed / windColors.length;

/** Returns the colour for the highest threshold that speed meets or exceeds. */
export function windColorScale(speed: number): string {
  const i = Math.floor(speed / step);
  return windColors[Math.max(0, Math.min(i, windColors.length - 1))];
}

/** Maps wind speed linearly to a stroke width in [0.75, 8]. */
export function strokeWidthScale(speed: number): number {
  return 0.75 + (Math.min(Math.max(speed, 0), windMaxSpeed) / windMaxSpeed) * (8 - 0.75);
}
