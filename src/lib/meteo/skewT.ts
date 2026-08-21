import type { SkewTWeatherData, WeatherModel } from '$lib/api/types';
import { getAtLevel, type VerticalProfile } from '$lib/api/types';
import {
  getAllTaggedLevelsForModel,
  getNativeLevelsForFetch,
  interpolatePressureAtHeight,
  metersToHPaExact,
  type TaggedPressureLevel,
} from './pressureLevels';
import { calculateLcl } from './lcl';
import { calculateThermalDiagnostics, calculateThermalStrength, THERMAL_TRIGGER_HEIGHT_AGL_METERS } from './thermal';
import { interpolateWind } from './wind';
import type { MaxAltitude, SkewTLevelData, SkewTTrace, SkewTData, PressureLevel } from './types';

interface BuildSkewTLevelOptions {
  weatherData: SkewTWeatherData;
  hourIndex: number;
  levels: TaggedPressureLevel[];
  nativeLevels: PressureLevel[];
}

function getProfileValue(profile: VerticalProfile, pressure: number, hourIndex: number): number | null {
  const arr = getAtLevel(profile, pressure);
  if (!arr) return null;
  const value = arr[hourIndex];
  if (value == null || Number.isNaN(value)) return null;
  return value;
}

function interpolateScalar(
  height: number,
  lowerH: number,
  upperH: number,
  lowerValue: number,
  upperValue: number
): number {
  const ratio = (height - lowerH) / (upperH - lowerH);
  return lowerValue + (upperValue - lowerValue) * ratio;
}

function buildLevelDataAtHour({
  weatherData,
  hourIndex,
  levels,
  nativeLevels,
}: BuildSkewTLevelOptions): SkewTLevelData[] {
  const tempProfile = weatherData.hourly.temperatureProfile as VerticalProfile;
  const dewProfile = weatherData.hourly.dewpointProfile as VerticalProfile;
  const windSpeedProfile = weatherData.hourly.windSpeedProfile as VerticalProfile;
  const windDirProfile = weatherData.hourly.windDirectionProfile as VerticalProfile;
  const cloudProfile = weatherData.hourly.cloudCoverProfile as VerticalProfile;
  const geoProfile = weatherData.hourly.geopotentialHeightProfile as VerticalProfile;

  // Actual geopotential heights for native levels at this hour
  const nativeActualHeights = new Map<number, number>();
  for (const nl of nativeLevels) {
    const h = getProfileValue(geoProfile, nl.hPa, hourIndex);
    if (h != null) nativeActualHeights.set(nl.hPa, h);
  }

  const bracketHeight = (nl: PressureLevel) => nativeActualHeights.get(nl.hPa) ?? nl.heightMeters;

  const nearestCloud = (levelHPa: number): number | null => {
    let best: PressureLevel | null = null;
    let bestDiff = Infinity;
    for (const nl of nativeLevels) {
      const diff = Math.abs(nl.hPa - levelHPa);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = nl;
      }
    }
    return best ? getProfileValue(cloudProfile, best.hPa, hourIndex) : null;
  };

  return levels.map((level) => {
    // Interpolate actual height in log-p space for non-native levels
    let actualHeight: number | null = null;
    if (level.source === 'model') {
      actualHeight = nativeActualHeights.get(level.hPa) ?? null;
    } else {
      const lower = [...nativeLevels].reverse().find((l) => l.hPa > level.hPa);
      const upper = nativeLevels.find((l) => l.hPa < level.hPa);
      if (lower && upper) {
        const lh = nativeActualHeights.get(lower.hPa);
        const uh = nativeActualHeights.get(upper.hPa);
        if (lh != null && uh != null) {
          const logP = Math.log(level.hPa);
          const logLo = Math.log(lower.hPa);
          const logHi = Math.log(upper.hPa);
          actualHeight = lh + ((uh - lh) * (logP - logLo)) / (logHi - logLo);
        }
      }
    }

    const targetHeight = actualHeight ?? level.heightMeters;

    // Bracket in pressure space (always correct regardless of height variability)
    const lowerNative = [...nativeLevels].reverse().find((l) => l.hPa > level.hPa);
    const upperNative = nativeLevels.find((l) => l.hPa < level.hPa);
    const lowerH = lowerNative ? bracketHeight(lowerNative) : NaN;
    const upperH = upperNative ? bracketHeight(upperNative) : NaN;

    const tempAtLevel = getProfileValue(tempProfile, level.hPa, hourIndex);
    const dewAtLevel = getProfileValue(dewProfile, level.hPa, hourIndex);
    const windSpeedAtLevel = getProfileValue(windSpeedProfile, level.hPa, hourIndex);
    const windDirAtLevel = getProfileValue(windDirProfile, level.hPa, hourIndex);
    const cloudAtLevel = getProfileValue(cloudProfile, level.hPa, hourIndex);

    const lowerTemp = lowerNative ? getProfileValue(tempProfile, lowerNative.hPa, hourIndex) : null;
    const upperTemp = upperNative ? getProfileValue(tempProfile, upperNative.hPa, hourIndex) : null;

    const lowerDew = lowerNative ? getProfileValue(dewProfile, lowerNative.hPa, hourIndex) : null;
    const upperDew = upperNative ? getProfileValue(dewProfile, upperNative.hPa, hourIndex) : null;

    const lowerWindSpeed = lowerNative ? getProfileValue(windSpeedProfile, lowerNative.hPa, hourIndex) : null;
    const upperWindSpeed = upperNative ? getProfileValue(windSpeedProfile, upperNative.hPa, hourIndex) : null;
    const lowerWindDir = lowerNative ? getProfileValue(windDirProfile, lowerNative.hPa, hourIndex) : null;
    const upperWindDir = upperNative ? getProfileValue(windDirProfile, upperNative.hPa, hourIndex) : null;

    const temperature =
      tempAtLevel ??
      (lowerNative && upperNative && isFinite(lowerH) && isFinite(upperH) && lowerTemp != null && upperTemp != null
        ? interpolateScalar(targetHeight, lowerH, upperH, lowerTemp, upperTemp)
        : NaN);

    const dewpoint =
      dewAtLevel ??
      (lowerNative && upperNative && isFinite(lowerH) && isFinite(upperH) && lowerDew != null && upperDew != null
        ? interpolateScalar(targetHeight, lowerH, upperH, lowerDew, upperDew)
        : NaN);

    let windSpeed = windSpeedAtLevel;
    let windDirection = windDirAtLevel;

    if (windSpeed == null || windDirection == null) {
      if (
        lowerNative &&
        upperNative &&
        isFinite(lowerH) &&
        isFinite(upperH) &&
        lowerWindSpeed != null &&
        upperWindSpeed != null &&
        lowerWindDir != null &&
        upperWindDir != null
      ) {
        const interpolated = interpolateWind(
          targetHeight,
          lowerNative,
          upperNative,
          { speed: lowerWindSpeed, direction: lowerWindDir },
          { speed: upperWindSpeed, direction: upperWindDir },
          lowerH,
          upperH
        );
        windSpeed = interpolated.speed;
        windDirection = interpolated.direction;
      } else {
        windSpeed = NaN;
        windDirection = NaN;
      }
    }

    const cloudCoverVal = cloudAtLevel ?? nearestCloud(level.hPa);
    const cloudCover = cloudCoverVal != null ? Math.round(cloudCoverVal) : NaN;

    return {
      pressure: level.hPa,
      heightMeters: targetHeight,
      temperature: Math.round(temperature * 10) / 10,
      dewpoint: Math.round(dewpoint * 10) / 10,
      windSpeed: Math.round(windSpeed * 10) / 10,
      windDirection: Math.round(windDirection),
      cloudCover,
      isInterpolated: level.source !== 'model',
    };
  });
}

export function buildSkewTData(
  weatherData: SkewTWeatherData,
  model: WeatherModel,
  maxAltitude: MaxAltitude
): SkewTData {
  const traces: SkewTTrace[] = [];
  const nativeLevels = getNativeLevelsForFetch(model, maxAltitude);
  const allLevels = getAllTaggedLevelsForModel(model, maxAltitude);

  weatherData.hourly.time.forEach((time, i) => {
    const surfaceTemp = weatherData.hourly.temperature_2m?.[i] ?? NaN;
    const surfaceDewpoint = weatherData.hourly.dewpoint_2m?.[i] ?? NaN;
    const lclValue = calculateLcl(surfaceTemp, surfaceDewpoint);
    const lclHeight = lclValue + weatherData.modelGridElevation;

    const levels = buildLevelDataAtHour({ weatherData, hourIndex: i, levels: allLevels, nativeLevels });
    const nativeDiagnosticLevels = buildLevelDataAtHour({
      weatherData,
      hourIndex: i,
      levels: nativeLevels.map((level) => ({ ...level, source: 'model' })),
      nativeLevels,
    });
    const requestedSurfacePressure = weatherData.hourly.surfacePressure?.[i] ?? NaN;
    const surfacePressure = Number.isFinite(requestedSurfacePressure)
      ? requestedSurfacePressure
      : metersToHPaExact(weatherData.modelGridElevation);
    const lclPressure = interpolatePressureAtHeight(lclHeight, [
      { hPa: surfacePressure, heightMeters: weatherData.modelGridElevation },
      ...nativeDiagnosticLevels
        .filter((level) => level.pressure < surfacePressure && level.heightMeters > weatherData.modelGridElevation)
        .map((level) => ({ hPa: level.pressure, heightMeters: level.heightMeters })),
    ]);
    const thermal = calculateThermalDiagnostics({
      surfaceTemperature: surfaceTemp,
      surfacePressure,
      elevation: weatherData.modelGridElevation,
      lclHeightMeters: lclHeight,
      maximumHeightMeters: maxAltitude,
      levels: nativeDiagnosticLevels.map((level) => ({
        pressure: level.pressure,
        heightMeters: level.heightMeters,
        temperature: level.temperature,
      })),
    });
    const thermalStrength =
      model === 'gfs_seamless'
        ? calculateThermalStrength({
            surfaceTemperature: surfaceTemp,
            surfaceDewpoint,
            surfacePressure,
            boundaryLayerHeightAglMeters: weatherData.hourly.boundaryLayerHeight[i] ?? NaN,
            sensibleHeatFlux: weatherData.hourly.sensibleHeatFlux[i] ?? NaN,
            latentHeatFlux: weatherData.hourly.latentHeatFlux[i] ?? NaN,
          })
        : null;
    traces.push({
      time,
      levels,
      lcl: lclHeight,
      lclHeightAglMeters: lclValue,
      lclPressure,
      surfaceTemp,
      surfaceDewpoint,
      surfacePressure,
      thermal,
      thermalStrength,
    });
  });

  const thermalTriggerTime =
    traces.find(
      (trace) =>
        trace.thermal.topHeightAglMeters != null &&
        trace.thermal.topHeightAglMeters >= THERMAL_TRIGGER_HEIGHT_AGL_METERS
    )?.time ?? null;

  return {
    traces,
    modelGridElevation: weatherData.modelGridElevation,
    timezone: weatherData.timezone,
    timezoneAbbr: weatherData.timezoneAbbr,
    pressureLevels: allLevels.map((l) => l.hPa),
    thermalTriggerTime,
  };
}
