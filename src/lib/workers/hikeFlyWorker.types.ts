import type { HikeFlyGridPoint } from '$lib/meteo/hikeAndFly';

export type HikeFlyImageCoordinate = [number, number];

export interface HikeFlyWorkerInput {
  takeoff: { latitude: number; longitude: number; elevation: number };
  glideRatio: number;
  stepMeters: number;
  tileUrlPattern: string;
}

export interface HikeFlyWorkerComputeRequest {
  type: 'compute';
  requestId: number;
  input: HikeFlyWorkerInput;
}

export interface HikeFlyWorkerLookupRequest {
  type: 'lookup';
  requestId: number;
  lookupId: number;
  latitude: number;
  longitude: number;
}

export type HikeFlyWorkerRequest = HikeFlyWorkerComputeRequest | HikeFlyWorkerLookupRequest;

export interface HikeFlyWorkerComputedData {
  blob: Blob;
  coordinates: [HikeFlyImageCoordinate, HikeFlyImageCoordinate, HikeFlyImageCoordinate, HikeFlyImageCoordinate];
}

export interface HikeFlyWorkerSuccessOutput {
  type: 'computed';
  requestId: number;
  success: true;
  data: HikeFlyWorkerComputedData;
}

export interface HikeFlyWorkerErrorOutput {
  type: 'computed';
  requestId: number;
  success: false;
  error: string;
}

export interface HikeFlyWorkerLookupOutput {
  type: 'lookup';
  requestId: number;
  lookupId: number;
  latitude: number;
  longitude: number;
  point: HikeFlyGridPoint | null;
}

export type HikeFlyWorkerOutput = HikeFlyWorkerSuccessOutput | HikeFlyWorkerErrorOutput | HikeFlyWorkerLookupOutput;
