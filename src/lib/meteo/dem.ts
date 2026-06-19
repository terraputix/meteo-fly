export type DemEncoding = 'terrarium' | 'mapbox';

export interface DemTile {
  width: number;
  height: number;
  data: Float32Array;
}

const TILE_EXTENT = 256;

function mercatorY(lat: number): number {
  return Math.log(Math.tan((lat * Math.PI) / 360 + Math.PI / 4));
}

function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * (1 << zoom));
}

function latToTileY(lat: number, zoom: number): number {
  const y = ((1 - mercatorY(lat) / Math.PI) / 2) * (1 << zoom);
  return Math.floor(Math.max(0, Math.min((1 << zoom) - 1, y)));
}

export function tilesForBbox(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  zoom: number
): Array<{ z: number; x: number; y: number }> {
  const xMin = lonToTileX(minLon, zoom);
  const xMax = lonToTileX(maxLon, zoom);
  const yMin = latToTileY(maxLat, zoom);
  const yMax = latToTileY(minLat, zoom);
  const tiles: Array<{ z: number; x: number; y: number }> = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push({ z: zoom, x, y });
    }
  }
  return tiles;
}

function decodeValue(r: number, g: number, b: number, encoding: DemEncoding): number {
  if (encoding === 'mapbox') {
    return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
  }
  return r * 256 + g + b / 256 - 32768;
}

export async function decodeDemTileImage(blob: Blob, encoding: DemEncoding): Promise<DemTile> {
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const rgba = imageData.data;

  const data = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const px = i << 2;
    data[i] = decodeValue(rgba[px], rgba[px + 1], rgba[px + 2], encoding);
  }

  bitmap.close();
  return { width, height, data };
}

export async function fetchDemTile(url: string, encoding: DemEncoding): Promise<DemTile> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`DEM tile fetch failed: ${response.status} for ${url}`);
  const blob = await response.blob();
  return decodeDemTileImage(blob, encoding);
}

export function formatTileUrl(pattern: string, z: number, x: number, y: number): string {
  return pattern.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

interface TileJson {
  tiles: string[];
  minzoom?: number;
  maxzoom?: number;
}

let resolvedTilePattern: string | null = null;
let resolvingTileJson: Promise<string> | null = null;

export async function resolveTileUrlPattern(tilejsonUrl: string): Promise<string> {
  if (resolvedTilePattern) return resolvedTilePattern;
  if (resolvingTileJson) return resolvingTileJson;

  resolvingTileJson = (async () => {
    const response = await fetch(tilejsonUrl);
    if (!response.ok) throw new Error(`TileJSON fetch failed: ${response.status}`);
    const json: TileJson = await response.json();
    const pattern = json.tiles[0];
    if (!pattern) throw new Error('TileJSON contains no tiles');
    resolvedTilePattern = pattern;
    return pattern;
  })();

  return resolvingTileJson;
}

export function pixelPositionInTile(
  lat: number,
  lon: number,
  zoom: number,
  tileX: number,
  tileY: number
): { px: number; py: number } {
  const tileCount = 1 << zoom;
  const mercY = mercatorY(lat);
  const px = (((lon + 180) / 360) * tileCount - tileX) * TILE_EXTENT;
  const py = (((1 - mercY / Math.PI) / 2) * tileCount - tileY) * TILE_EXTENT;
  return { px, py };
}

export function sampleBilinear(data: Float32Array, width: number, height: number, px: number, py: number): number {
  const ix = Math.max(0, Math.min(Math.floor(px), width - 2));
  const iy = Math.max(0, Math.min(Math.floor(py), height - 2));
  const fx = Math.min(px - ix, 1);
  const fy = Math.min(py - iy, 1);
  const stride = width;

  const a = data[iy * stride + ix];
  const b = data[iy * stride + ix + 1];
  const c = data[(iy + 1) * stride + ix];
  const d = data[(iy + 1) * stride + ix + 1];

  return a + fx * (b - a) + fy * (c - a) + fx * fy * (a - b - c + d);
}

export function createElevationLookup(
  tiles: Map<string, DemTile>,
  zoom: number
): (lat: number, lon: number) => number | null {
  return (lat: number, lon: number): number | null => {
    const tx = lonToTileX(lon, zoom);
    const ty = latToTileY(lat, zoom);
    const key = `${zoom}/${tx}/${ty}`;
    const tile = tiles.get(key);
    if (!tile) return null;

    const { px, py } = pixelPositionInTile(lat, lon, zoom, tx, ty);
    const scale = tile.width / TILE_EXTENT;
    const elevation = sampleBilinear(tile.data, tile.width, tile.height, px * scale, py * scale);
    return isNaN(elevation) ? null : elevation;
  };
}
