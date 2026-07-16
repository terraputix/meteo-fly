import {
  EARTH_RADIUS,
  generateReachableArea,
  toRadians,
  visitKey,
  type HikeFlyConfig,
  type HikeFlyGridPoint,
} from '$lib/meteo/hikeAndFly';

export interface PreparedHikeFlyData {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  pointLookup: Map<string, HikeFlyGridPoint>;
  stepDegreesLatitude: number;
}

export function heightAGLToRgba(height: number): [number, number, number, number] {
  if (height <= 0) return [239, 68, 68, 140];
  if (height <= 50) return [239, 120, 30, 145];
  if (height <= 100) return [220, 204, 40, 145];
  if (height <= 200) return [132, 204, 22, 150];
  if (height <= 350) return [34, 197, 94, 155];
  if (height <= 500) return [20, 184, 166, 160];
  if (height <= 750) return [30, 100, 180, 165];
  return [20, 50, 140, 170];
}

export function prepareHikeFlyData(
  config: HikeFlyConfig,
  getElevation: (latitude: number, longitude: number) => number | null,
  maxIterations?: number
): PreparedHikeFlyData {
  const reachable = generateReachableArea(config, getElevation, maxIterations);
  if (reachable.length === 0) throw new Error('No reachable terrain points found');

  const earthCircumference = 2 * Math.PI * EARTH_RADIUS;
  const stepDegreesLatitude = (config.stepMeters / earthCircumference) * 360;
  const pointLookup = new Map<string, HikeFlyGridPoint>();
  let minLatitude = Infinity;
  let maxLatitude = -Infinity;
  let minLongitude = Infinity;
  let maxLongitude = -Infinity;

  for (const point of reachable) {
    const key = visitKey(
      config.takeoff.latitude,
      config.takeoff.longitude,
      point.latitude,
      point.longitude,
      stepDegreesLatitude
    );
    pointLookup.set(key, point);
    minLatitude = Math.min(minLatitude, point.latitude);
    maxLatitude = Math.max(maxLatitude, point.latitude);
    minLongitude = Math.min(minLongitude, point.longitude);
    maxLongitude = Math.max(maxLongitude, point.longitude);
  }

  const cosineLatitude = Math.cos(toRadians((minLatitude + maxLatitude) / 2));
  const stepDegreesLongitude = cosineLatitude > 0.01 ? stepDegreesLatitude / cosineLatitude : stepDegreesLatitude;
  const width = Math.round((maxLongitude - minLongitude) / stepDegreesLongitude) + 1;
  const height = Math.round((maxLatitude - minLatitude) / stepDegreesLatitude) + 1;
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (const point of reachable) {
    const column = Math.round((point.longitude - minLongitude) / stepDegreesLongitude);
    const row = Math.round((maxLatitude - point.latitude) / stepDegreesLatitude);
    if (column < 0 || column >= width || row < 0 || row >= height) continue;

    const color = heightAGLToRgba(point.heightAGL);
    pixels.set(color, (row * width + column) * 4);
  }

  return {
    width,
    height,
    pixels,
    coordinates: [
      [minLongitude, maxLatitude],
      [maxLongitude + stepDegreesLongitude, maxLatitude],
      [maxLongitude + stepDegreesLongitude, minLatitude - stepDegreesLatitude],
      [minLongitude, minLatitude - stepDegreesLatitude],
    ],
    pointLookup,
    stepDegreesLatitude,
  };
}
