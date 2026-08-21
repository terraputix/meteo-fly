import { CP, EPS, LV, RD, saturationVaporPressure } from './thermo';
import type { ThermalDiagnostics, ThermalLevelData, ThermalStrengthData } from './types';

const KELVIN_OFFSET = 273.15;
const POISSON_EXPONENT = 0.2854;
const THERMAL_INDEX_EPSILON = 0.01;
const GRAVITY = 9.80665;

export const THERMAL_TRIGGER_HEIGHT_AGL_METERS = 1200;

export interface ThermalProfileLevel {
  pressure: number;
  heightMeters: number;
  temperature: number;
}

export interface ThermalDiagnosticsInput {
  surfaceTemperature: number;
  surfacePressure: number;
  elevation: number;
  lclHeightMeters: number;
  levels: ThermalProfileLevel[];
  maximumHeightMeters?: number;
}

export interface ThermalStrengthInput {
  surfaceTemperature: number;
  surfaceDewpoint: number;
  surfacePressure: number;
  boundaryLayerHeightAglMeters: number;
  sensibleHeatFlux: number;
  latentHeatFlux: number;
}

export function calculateThermalStrength({
  surfaceTemperature,
  surfaceDewpoint,
  surfacePressure,
  boundaryLayerHeightAglMeters,
  sensibleHeatFlux,
  latentHeatFlux,
}: ThermalStrengthInput): ThermalStrengthData | null {
  if (
    !Number.isFinite(surfaceTemperature) ||
    !Number.isFinite(surfacePressure) ||
    surfacePressure <= 0 ||
    !Number.isFinite(boundaryLayerHeightAglMeters) ||
    boundaryLayerHeightAglMeters <= 0 ||
    !Number.isFinite(sensibleHeatFlux) ||
    sensibleHeatFlux <= 0
  ) {
    return null;
  }

  const temperatureKelvin = surfaceTemperature + KELVIN_OFFSET;
  if (temperatureKelvin <= 0) return null;
  const vaporPressure = Number.isFinite(surfaceDewpoint) ? saturationVaporPressure(surfaceDewpoint) : 0;
  const specificHumidity =
    vaporPressure > 0 ? (EPS * vaporPressure) / (surfacePressure - (1 - EPS) * vaporPressure) : 0;
  const virtualTemperature = temperatureKelvin * (1 + 0.61 * specificHumidity);
  const airDensity = (surfacePressure * 100) / (RD * virtualTemperature);
  if (!Number.isFinite(airDensity) || airDensity <= 0) return null;
  const moistureFlux = Number.isFinite(latentHeatFlux) ? latentHeatFlux : 0;
  const surfaceBuoyancyFlux =
    GRAVITY *
    (sensibleHeatFlux / (airDensity * CP * temperatureKelvin) +
      (0.61 * moistureFlux) / (airDensity * LV * (1 + 0.61 * specificHumidity)));

  if (!Number.isFinite(surfaceBuoyancyFlux) || surfaceBuoyancyFlux <= 0) return null;

  return {
    convectiveVelocityScale: Math.cbrt(surfaceBuoyancyFlux * boundaryLayerHeightAglMeters),
    boundaryLayerHeightAglMeters,
    surfaceBuoyancyFlux,
  };
}

export function calculateDryParcelTemperature(
  surfaceTemperature: number,
  surfacePressure: number,
  pressure: number
): number {
  return (surfaceTemperature + KELVIN_OFFSET) * Math.pow(pressure / surfacePressure, POISSON_EXPONENT) - KELVIN_OFFSET;
}

function triggerTemperature(environmentTemperature: number, surfacePressure: number, pressure: number): number {
  return (
    (environmentTemperature + KELVIN_OFFSET) * Math.pow(surfacePressure / pressure, POISSON_EXPONENT) - KELVIN_OFFSET
  );
}

function interpolateAtHeight(levels: ThermalLevelData[], heightMeters: number): ThermalLevelData | null {
  const exact = levels.find((level) => Math.abs(level.heightMeters - heightMeters) < 0.01);
  if (exact) return exact;

  for (let i = 0; i < levels.length - 1; i++) {
    const lower = levels[i];
    const upper = levels[i + 1];
    if (heightMeters <= lower.heightMeters || heightMeters >= upper.heightMeters) continue;

    const ratio = (heightMeters - lower.heightMeters) / (upper.heightMeters - lower.heightMeters);
    const interpolate = (from: number, to: number) => from + (to - from) * ratio;
    const pressure = Math.exp(interpolate(Math.log(lower.pressure), Math.log(upper.pressure)));
    const environmentTemperature = interpolate(lower.environmentTemperature, upper.environmentTemperature);
    const surface = levels[0];
    const parcelTemperatureAtHeight = calculateDryParcelTemperature(
      surface.environmentTemperature,
      surface.pressure,
      pressure
    );

    return {
      pressure,
      heightMeters,
      environmentTemperature,
      parcelTemperature: parcelTemperatureAtHeight,
      thermalIndex: environmentTemperature - parcelTemperatureAtHeight,
      triggerTemperature: triggerTemperature(environmentTemperature, surface.pressure, pressure),
      isSurface: false,
    };
  }

  return null;
}

function findThermalTop(levels: ThermalLevelData[]) {
  let minimumThermalIndex: number | null = null;
  let hasBuoyantLayer = false;

  for (let i = 1; i < levels.length; i++) {
    const current = levels[i];
    const previous = levels[i - 1];

    if (current.thermalIndex < -THERMAL_INDEX_EPSILON) {
      hasBuoyantLayer = true;
      minimumThermalIndex = Math.min(minimumThermalIndex ?? current.thermalIndex, current.thermalIndex);
      continue;
    }

    if (current.thermalIndex > THERMAL_INDEX_EPSILON) {
      if (!hasBuoyantLayer) {
        return { heightMeters: null, pressure: null, aboveProfile: false, minimumThermalIndex: null };
      }

      const ratio = -previous.thermalIndex / (current.thermalIndex - previous.thermalIndex);
      return {
        heightMeters: previous.heightMeters + (current.heightMeters - previous.heightMeters) * ratio,
        pressure: Math.exp(
          Math.log(previous.pressure) + (Math.log(current.pressure) - Math.log(previous.pressure)) * ratio
        ),
        aboveProfile: false,
        minimumThermalIndex,
      };
    }
  }

  const last = levels.at(-1);
  return hasBuoyantLayer && last
    ? {
        heightMeters: last.heightMeters,
        pressure: last.pressure,
        aboveProfile: true,
        minimumThermalIndex,
      }
    : { heightMeters: null, pressure: null, aboveProfile: false, minimumThermalIndex: null };
}

function triggerTemperatureToHeight(levels: ThermalLevelData[], targetHeightMeters: number): number | null {
  const target = interpolateAtHeight(levels, targetHeightMeters);
  if (!target) return null;

  const temperatures = levels
    .filter((level) => !level.isSurface && level.heightMeters < targetHeightMeters)
    .map((level) => level.triggerTemperature);
  temperatures.push(target.triggerTemperature);
  return Math.max(...temperatures);
}

export function calculateThermalDiagnostics({
  surfaceTemperature,
  surfacePressure,
  elevation,
  lclHeightMeters,
  levels,
  maximumHeightMeters,
}: ThermalDiagnosticsInput): ThermalDiagnostics {
  const unavailable: ThermalDiagnostics = {
    levels: [],
    topHeightMeters: null,
    topHeightAglMeters: null,
    topPressure: null,
    topIsAboveProfile: false,
    minimumThermalIndex: null,
    triggerTemperature: null,
    reachesLcl: null,
  };

  if (
    !Number.isFinite(surfaceTemperature) ||
    !Number.isFinite(surfacePressure) ||
    surfacePressure <= 0 ||
    !Number.isFinite(elevation)
  ) {
    return unavailable;
  }

  const profileLevels = levels
    .filter(
      (level) =>
        Number.isFinite(level.pressure) &&
        level.pressure > 0 &&
        level.pressure < surfacePressure &&
        Number.isFinite(level.heightMeters) &&
        level.heightMeters > elevation &&
        Number.isFinite(level.temperature)
    )
    .sort((a, b) => a.heightMeters - b.heightMeters);

  const uncappedDiagnosticLevels: ThermalLevelData[] = [
    {
      pressure: surfacePressure,
      heightMeters: elevation,
      environmentTemperature: surfaceTemperature,
      parcelTemperature: surfaceTemperature,
      thermalIndex: 0,
      triggerTemperature: surfaceTemperature,
      isSurface: true,
    },
    ...profileLevels.map((level) => {
      const parcelTemperatureAtLevel = calculateDryParcelTemperature(
        surfaceTemperature,
        surfacePressure,
        level.pressure
      );
      return {
        pressure: level.pressure,
        heightMeters: level.heightMeters,
        environmentTemperature: level.temperature,
        parcelTemperature: parcelTemperatureAtLevel,
        thermalIndex: level.temperature - parcelTemperatureAtLevel,
        triggerTemperature: triggerTemperature(level.temperature, surfacePressure, level.pressure),
        isSurface: false,
      };
    }),
  ];

  if (uncappedDiagnosticLevels.length < 2) return unavailable;

  let diagnosticLevels = uncappedDiagnosticLevels;
  if (maximumHeightMeters != null && Number.isFinite(maximumHeightMeters)) {
    const levelAtMaximumHeight = interpolateAtHeight(uncappedDiagnosticLevels, maximumHeightMeters);
    diagnosticLevels = uncappedDiagnosticLevels.filter((level) => level.heightMeters <= maximumHeightMeters);
    if (
      levelAtMaximumHeight &&
      !diagnosticLevels.some((level) => Math.abs(level.heightMeters - maximumHeightMeters) < 0.01)
    ) {
      diagnosticLevels.push(levelAtMaximumHeight);
    }
  }

  if (diagnosticLevels.length < 2) return unavailable;

  const top = findThermalTop(diagnosticLevels);
  const topHeightAglMeters = top.heightMeters == null ? null : Math.max(0, top.heightMeters - elevation);
  const highestProfileHeight = diagnosticLevels.at(-1)?.heightMeters ?? elevation;
  const reachesLcl =
    top.heightMeters == null || !Number.isFinite(lclHeightMeters)
      ? null
      : top.aboveProfile && lclHeightMeters > highestProfileHeight
        ? null
        : top.heightMeters >= lclHeightMeters;

  return {
    levels: diagnosticLevels,
    topHeightMeters: top.heightMeters,
    topHeightAglMeters,
    topPressure: top.pressure,
    topIsAboveProfile: top.aboveProfile,
    minimumThermalIndex: top.minimumThermalIndex,
    triggerTemperature: triggerTemperatureToHeight(diagnosticLevels, elevation + THERMAL_TRIGGER_HEIGHT_AGL_METERS),
    reachesLcl,
  };
}
