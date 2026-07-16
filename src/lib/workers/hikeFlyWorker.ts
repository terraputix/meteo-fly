import {
  boundsForRadius,
  createElevationLookup,
  fetchDemTile,
  formatTileUrl,
  tilesForBbox,
  type DemTile,
} from '$lib/meteo/dem';
import { visitKey } from '$lib/meteo/hikeAndFly';
import { prepareHikeFlyData } from './prepareHikeFlyData';
import type {
  HikeFlyWorkerComputeRequest,
  HikeFlyWorkerErrorOutput,
  HikeFlyWorkerLookupOutput,
  HikeFlyWorkerRequest,
  HikeFlyWorkerSuccessOutput,
} from './hikeFlyWorker.types';

const DEM_ZOOM = 12;
const DEM_ENCODING = 'terrarium' as const;

const tileCache = new Map<string, DemTile>();
let lookupState:
  | {
      requestId: number;
      takeoff: { latitude: number; longitude: number; elevation: number };
      stepDegreesLatitude: number;
      points: ReturnType<typeof prepareHikeFlyData>['pointLookup'];
    }
  | undefined;

async function compute(request: HikeFlyWorkerComputeRequest): Promise<void> {
  const { requestId, input } = request;
  const { takeoff, glideRatio, stepMeters, tileUrlPattern } = input;
  lookupState = undefined;

  try {
    const maxGlideMeters = glideRatio * Math.max(takeoff.elevation, 100);
    const bounds = boundsForRadius(takeoff.latitude, takeoff.longitude, maxGlideMeters, 1.2);
    const neededTiles = tilesForBbox(
      bounds.minLatitude,
      bounds.maxLatitude,
      bounds.minLongitude,
      bounds.maxLongitude,
      DEM_ZOOM
    );

    await Promise.all(
      neededTiles.map(async (tile) => {
        const key = `${tile.z}/${tile.x}/${tile.y}`;
        if (tileCache.has(key)) return;

        try {
          const url = formatTileUrl(tileUrlPattern, tile.z, tile.x, tile.y);
          tileCache.set(key, await fetchDemTile(url, DEM_ENCODING));
        } catch (error) {
          console.warn('Failed to fetch DEM tile:', key, error);
        }
      })
    );

    const getElevation = createElevationLookup(tileCache, DEM_ZOOM);
    const takeoffElevation = getElevation(takeoff.latitude, takeoff.longitude);
    if (takeoffElevation == null) throw new Error('No DEM elevation available at takeoff');

    const prepared = prepareHikeFlyData(
      {
        takeoff: { ...takeoff, elevation: takeoffElevation },
        glideRatio,
        initialAltitude: 0,
        stepMeters,
      },
      getElevation
    );
    const canvas = new OffscreenCanvas(prepared.width, prepared.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create raster canvas context');

    const imageData = context.createImageData(prepared.width, prepared.height);
    imageData.data.set(prepared.pixels);
    context.putImageData(imageData, 0, 0);
    const blob = await canvas.convertToBlob();

    lookupState = {
      requestId,
      takeoff,
      stepDegreesLatitude: prepared.stepDegreesLatitude,
      points: prepared.pointLookup,
    };

    const response: HikeFlyWorkerSuccessOutput = {
      type: 'computed',
      requestId,
      success: true,
      data: { blob, coordinates: prepared.coordinates },
    };
    self.postMessage(response);
  } catch (error) {
    const response: HikeFlyWorkerErrorOutput = {
      type: 'computed',
      requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    self.postMessage(response);
  }
}

self.onmessage = (event: MessageEvent<HikeFlyWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'compute') {
    void compute(request);
    return;
  }

  const point =
    lookupState?.requestId === request.requestId
      ? (lookupState.points.get(
          visitKey(
            lookupState.takeoff.latitude,
            lookupState.takeoff.longitude,
            request.latitude,
            request.longitude,
            lookupState.stepDegreesLatitude
          )
        ) ?? null)
      : null;
  const response: HikeFlyWorkerLookupOutput = { ...request, point };
  self.postMessage(response);
};
