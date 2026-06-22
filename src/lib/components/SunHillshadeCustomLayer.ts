import { vertexShader, fragmentShader } from './sunHillshadeShader.glsl';
import { resolveTileUrlPattern, formatTileUrl, tilesForBbox } from '$lib/meteo/dem';
import { calcSunPosition } from '$lib/meteo/sunPosition';
import type { CustomLayerInterface, Map as MapLibreMap, CustomRenderMethodInput } from 'maplibre-gl';

interface LoadedTile {
  x: number;
  y: number;
  z: number;
  texture: WebGLTexture;
  width: number;
  height: number;
  clipQuad: Float32Array;
}

interface PendingTile {
  x: number;
  y: number;
  z: number;
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

function compileShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const TILE_UV = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);

function safeUniform1f(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  loc: WebGLUniformLocation | null,
  v: number
) {
  if (loc !== null) gl.uniform1f(loc, v);
}

function safeUniform1i(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  loc: WebGLUniformLocation | null,
  v: number
) {
  if (loc !== null) gl.uniform1i(loc, v);
}

function safeUniform2f(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  loc: WebGLUniformLocation | null,
  a: number,
  b: number
) {
  if (loc !== null) gl.uniform2f(loc, a, b);
}

export default class SunHillshadeCustomLayer implements CustomLayerInterface {
  id = 'sun-hillshade-custom-layer';
  type = 'custom' as const;
  renderingMode = '2d' as const;

  private map: MapLibreMap | null = null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;

  private uDem: WebGLUniformLocation | null = null;
  private uSunAzimuth: WebGLUniformLocation | null = null;
  private uSunElevation: WebGLUniformLocation | null = null;
  private uTexelSize: WebGLUniformLocation | null = null;
  private aPosition: number = 0;
  private aUv: number = 0;

  private uvBuffer: WebGLBuffer | null = null;
  private posBuffer: WebGLBuffer | null = null;

  private loadedTiles = new Map<string, LoadedTile>();
  private pendingTiles: PendingTile[] = [];
  private fetchingTiles = new Set<string>();

  private sunAzimuth = 0;
  private sunElevation = 45;
  private demZoom = 12;
  private lastDemZoom = 12;
  private resolvedTilePattern: string | null = null;
  private resolvingTileJson = false;

  updateSunTime(_date: Date, _latitude: number, _longitude: number) {
    const pos = calcSunPosition(_latitude, _longitude, _date);
    this.sunAzimuth = pos.azimuth;
    this.sunElevation = pos.elevation;
    this.map?.triggerRepaint();
  }

  private scheduleTileUpdate() {
    if (!this.map) return;
    this.loadTilesForViewport();
    this.updateAllClipQuads();
    this.map.triggerRepaint();
  }

  private updateTileClipQuad(tile: LoadedTile) {
    if (!this.map) return;
    const z2 = 1 << tile.z;
    const west = (tile.x / z2) * 360 - 180;
    const east = ((tile.x + 1) / z2) * 360 - 180;
    const north = mercatorYInv(tile.y / z2);
    const south = mercatorYInv((tile.y + 1) / z2);

    const nw = this.map.project([west, north]);
    const ne = this.map.project([east, north]);
    const se = this.map.project([east, south]);
    const sw = this.map.project([west, south]);

    const canvas = this.map.getCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const toClip = (p: { x: number; y: number }) => [(p.x / w) * 2 - 1, -((p.y / h) * 2 - 1)];

    const [nwx, nwy] = toClip(nw);
    const [nex, ney] = toClip(ne);
    const [sex, sey] = toClip(se);
    const [swx, swy] = toClip(sw);

    const q = tile.clipQuad;
    q[0] = nwx;
    q[1] = nwy;
    q[2] = nex;
    q[3] = ney;
    q[4] = sex;
    q[5] = sey;
    q[6] = nwx;
    q[7] = nwy;
    q[8] = sex;
    q[9] = sey;
    q[10] = swx;
    q[11] = swy;
  }

  private updateAllClipQuads() {
    for (const tile of this.loadedTiles.values()) {
      this.updateTileClipQuad(tile);
    }
  }

  private clearAllTiles() {
    const gl = this.gl;
    if (gl) {
      for (const tile of this.loadedTiles.values()) gl.deleteTexture(tile.texture);
    }
    for (const p of this.pendingTiles) p.bitmap.close();
    this.loadedTiles.clear();
    this.pendingTiles = [];
    this.fetchingTiles.clear();
  }

  private async loadTilesForViewport() {
    if (!this.map) return;
    const bounds = this.map.getBounds();
    const mapZoom = Math.round(this.map.getZoom());
    this.demZoom = Math.min(14, Math.max(10, mapZoom + 2));

    if (this.demZoom !== this.lastDemZoom) {
      this.lastDemZoom = this.demZoom;
      this.clearAllTiles();
    }

    if (!this.resolvedTilePattern) {
      if (this.resolvingTileJson) return;
      this.resolvingTileJson = true;
      try {
        this.resolvedTilePattern = await resolveTileUrlPattern('https://tiles.mapterhorn.com/tilejson.json');
      } catch (err) {
        console.error('Failed to resolve tile pattern:', err);
        this.resolvingTileJson = false;
        return;
      }
      this.resolvingTileJson = false;
    }

    const margin = 0.02;
    const neededTiles = tilesForBbox(
      bounds.getSouth() - margin,
      bounds.getNorth() + margin,
      bounds.getWest() - margin,
      bounds.getEast() + margin,
      this.demZoom
    );

    for (const t of neededTiles) {
      const key = `${t.z}/${t.x}/${t.y}`;
      if (this.loadedTiles.has(key) || this.fetchingTiles.has(key)) continue;
      this.fetchingTiles.add(key);

      const url = formatTileUrl(this.resolvedTilePattern, t.z, t.x, t.y);
      this.fetchTile(url, t.z, t.x, t.y, key);
    }
  }

  private async fetchTile(url: string, z: number, x: number, y: number, key: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      if (key === `${z}/${x}/${y}`) {
        this.pendingTiles.push({ x, y, z, bitmap, width: bitmap.width, height: bitmap.height });
        this.map?.triggerRepaint();
      } else {
        bitmap.close();
      }
    } catch (err) {
      console.warn('Failed to fetch DEM tile:', key, err);
    } finally {
      this.fetchingTiles.delete(key);
    }
  }

  private uploadPendingTiles(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    for (const p of this.pendingTiles) {
      const texture = gl.createTexture();
      if (!texture) continue;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, p.bitmap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      p.bitmap.close();

      const key = `${p.z}/${p.x}/${p.y}`;
      const tile: LoadedTile = {
        x: p.x,
        y: p.y,
        z: p.z,
        texture,
        width: p.width,
        height: p.height,
        clipQuad: new Float32Array(12),
      };
      this.updateTileClipQuad(tile);
      this.loadedTiles.set(key, tile);
    }
    this.pendingTiles = [];
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.gl = gl;

    const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }
    this.program = program;
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    this.uDem = gl.getUniformLocation(program, 'u_dem');
    this.uSunAzimuth = gl.getUniformLocation(program, 'u_sunAzimuth');
    this.uSunElevation = gl.getUniformLocation(program, 'u_sunElevation');
    this.uTexelSize = gl.getUniformLocation(program, 'u_texelSize');
    this.aPosition = gl.getAttribLocation(program, 'a_position');
    this.aUv = gl.getAttribLocation(program, 'a_uv');

    this.uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, TILE_UV, gl.STATIC_DRAW);

    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 12 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

    const onMove = () => this.scheduleTileUpdate();
    map.on('moveend', onMove);
    map.on('zoomend', onMove);
    this.scheduleTileUpdate();
  }

  onRemove(_map: MapLibreMap, _gl: WebGLRenderingContext | WebGL2RenderingContext) {
    void _map;
    void _gl;
    const gl = this.gl;
    if (gl) {
      if (this.program) gl.deleteProgram(this.program);
      if (this.uvBuffer) gl.deleteBuffer(this.uvBuffer);
      if (this.posBuffer) gl.deleteBuffer(this.posBuffer);
      for (const tile of this.loadedTiles.values()) gl.deleteTexture(tile.texture);
      for (const p of this.pendingTiles) p.bitmap.close();
    }
    this.loadedTiles.clear();
    this.pendingTiles = [];
    this.fetchingTiles.clear();
    this.map = null;
    this.gl = null;
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, _options: CustomRenderMethodInput) {
    void _options;
    if (!this.program || !this.map) return;

    this.uploadPendingTiles(gl);

    if (this.loadedTiles.size === 0) {
      this.loadTilesForViewport();
      return;
    }

    gl.useProgram(this.program);

    safeUniform1i(gl, this.uDem, 0);
    safeUniform1f(gl, this.uSunAzimuth, this.sunAzimuth);
    safeUniform1f(gl, this.uSunElevation, this.sunElevation);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    for (const tile of this.loadedTiles.values()) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tile.texture);

      safeUniform2f(gl, this.uTexelSize, 1 / tile.width, 1 / tile.height);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, tile.clipQuad);
      gl.enableVertexAttribArray(this.aPosition);
      gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
      gl.enableVertexAttribArray(this.aUv);
      gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }
}

function mercatorYInv(tileYNorm: number): number {
  return (2 * Math.atan(Math.exp(Math.PI * (1 - 2 * tileYNorm))) - Math.PI / 2) * (180 / Math.PI);
}
