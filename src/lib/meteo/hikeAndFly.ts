export interface HikeFlyGridPoint {
  latitude: number;
  longitude: number;
  distance: number;
  terrainElevation: number;
  heightAGL: number;
}

export interface HikeFlyConfig {
  takeoff: { latitude: number; longitude: number; elevation: number };
  glideRatio: number;
  initialAltitude: number;
  stepMeters: number;
}

export const HIKE_FLY_DEFAULT_GLIDE_RATIO = 6;
export const HIKE_FLY_DEFAULT_STEP_M = 100;

export const EARTH_RADIUS = 6_371_000;

export function toRadians(v: number): number {
  return (v * Math.PI) / 180;
}

/**
 * Grid cell key for the Dijkstra grid, used both during computation and
 * for looking up results by coordinates.
 */
export function visitKey(originLat: number, originLon: number, lat: number, lon: number, stepDegLat: number): string {
  const i = Math.round((lat - originLat) / stepDegLat);
  const cosLat = Math.cos(toRadians(lat));
  const stepDegLon = cosLat > 0.01 ? stepDegLat / cosLat : stepDegLat;
  const j = Math.round((lon - originLon) / stepDegLon);
  return `${i},${j}`;
}

/**
 * Haversine distance between two points in meters.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Min-heap priority queue keyed by distance.
 */
class DistHeap {
  private heap: Array<{ lat: number; lon: number; dist: number }> = [];

  get size(): number {
    return this.heap.length;
  }

  push(item: { lat: number; lon: number; dist: number }): void {
    this.heap.push(item);
    let i = this.heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].dist <= this.heap[i].dist) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  pop(): { lat: number; lon: number; dist: number } | undefined {
    if (this.heap.length === 0) return;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      let i = 0;
      const n = this.heap.length;
      while (true) {
        let smallest = i;
        const l = (i << 1) + 1;
        const r = l + 1;
        if (l < n && this.heap[l].dist < this.heap[smallest].dist) smallest = l;
        if (r < n && this.heap[r].dist < this.heap[smallest].dist) smallest = r;
        if (smallest === i) break;
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * Generate a reachable area using Dijkstra: start from takeoff and explore
 * neighboring grid points, always expanding the shortest-distance cell first.
 * Terrain obstacles naturally block expansion — no fixed radius needed.
 *
 * @returns reachable grid points (sorted by distance from takeoff)
 */
export function generateReachableArea(
  config: HikeFlyConfig,
  getTerrainElevation: (lat: number, lon: number) => number | null,
  maxIterations = 500_000
): HikeFlyGridPoint[] {
  const { takeoff, glideRatio, initialAltitude, stepMeters } = config;

  const earthCirc = 2 * Math.PI * EARTH_RADIUS;
  const stepDegLat = (stepMeters / earthCirc) * 360;

  const points: HikeFlyGridPoint[] = [];
  const settled = new Set<string>();
  const bestDist = new Map<string, number>();
  const heap = new DistHeap();

  const pushCell = (lat: number, lon: number, dist: number) => {
    const k = visitKey(takeoff.latitude, takeoff.longitude, lat, lon, stepDegLat);
    const prev = bestDist.get(k);
    if (prev != null && prev <= dist) return;
    bestDist.set(k, dist);
    heap.push({ lat, lon, dist });
  };

  pushCell(takeoff.latitude, takeoff.longitude, 0);

  for (let iterations = 0; heap.size > 0 && iterations < maxIterations; iterations++) {
    const { lat, lon, dist } = heap.pop()!;

    const k = visitKey(takeoff.latitude, takeoff.longitude, lat, lon, stepDegLat);
    if (settled.has(k)) continue;
    settled.add(k);

    const terrainElev = getTerrainElevation(lat, lon);
    if (terrainElev == null) continue;

    const heightAGL = computeHeightAGL(takeoff.elevation, initialAltitude, dist, glideRatio, terrainElev);

    points.push({
      latitude: lat,
      longitude: lon,
      distance: Math.round(dist),
      terrainElevation: Math.round(terrainElev),
      heightAGL: Math.round(heightAGL * 10) / 10,
    });

    const cosLat = Math.cos(toRadians(lat));
    const stepDegLon = cosLat > 0.01 ? stepDegLat / cosLat : stepDegLat;

    if (heightAGL < 0) continue;

    for (const [dLat, dLon] of [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ] as const) {
      const nLat = lat + dLat * stepDegLat;
      const nLon = lon + dLon * stepDegLon;
      const stepDist = haversineDistance(lat, lon, nLat, nLon);
      pushCell(nLat, nLon, dist + stepDist);
    }
  }

  return points;
}

/**
 * Compute height AGL of a paraglider at a given distance from takeoff:
 *
 *   heightAGL = takeoffElevation + initialAltitude - distance / glideRatio - terrainElevation
 *
 * Positive values mean the pilot is above the terrain (reachable).
 * Negative values mean the pilot has already landed.
 */
export function computeHeightAGL(
  takeoffElevation: number,
  initialAltitude: number,
  distance: number,
  glideRatio: number,
  terrainElevation: number
): number {
  return takeoffElevation + initialAltitude - distance / glideRatio - terrainElevation;
}
