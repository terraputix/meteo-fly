import type { SkewTWeatherData, WeatherModel } from '$lib/api/types';
import { getAtLevel, type VerticalProfile } from '$lib/api/types';
import { getAllTaggedLevelsForModel, getNativeLevelsForFetch, type TaggedPressureLevel } from './pressureLevels';
import { calculateLcl } from './lcl';
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
  lower: PressureLevel,
  upper: PressureLevel,
  lowerValue: number,
  upperValue: number
): number {
  const ratio = (height - lower.heightMeters) / (upper.heightMeters - lower.heightMeters);
  return lowerValue + (upperValue - lowerValue) * ratio;
}

export function dedupeLevels(levels: TaggedPressureLevel[]): TaggedPressureLevel[] {
  const byHpa = new Map<number, TaggedPressureLevel>();

  levels.forEach((level) => {
    const existing = byHpa.get(level.hPa);
    if (!existing || (existing.source === 'interpolated' && level.source === 'model')) {
      byHpa.set(level.hPa, level);
    }
  });

  return [...byHpa.values()].sort((a, b) => a.heightMeters - b.heightMeters);
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

  const reversedNative = [...nativeLevels].reverse();

  return levels.map((level) => {
    const targetHeight = level.heightMeters;
    const lowerNative = reversedNative.find((l) => l.heightMeters <= targetHeight);
    const upperNative = nativeLevels.find((l) => l.heightMeters > targetHeight);

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
      (lowerNative && upperNative && lowerTemp != null && upperTemp != null
        ? interpolateScalar(targetHeight, lowerNative, upperNative, lowerTemp, upperTemp)
        : NaN);

    const dewpoint =
      dewAtLevel ??
      (lowerNative && upperNative && lowerDew != null && upperDew != null
        ? interpolateScalar(targetHeight, lowerNative, upperNative, lowerDew, upperDew)
        : NaN);

    let windSpeed = windSpeedAtLevel;
    let windDirection = windDirAtLevel;

    if (windSpeed == null || windDirection == null) {
      if (
        lowerNative &&
        upperNative &&
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
          { speed: upperWindSpeed, direction: upperWindDir }
        );
        windSpeed = interpolated.speed;
        windDirection = interpolated.direction;
      } else {
        windSpeed = 0;
        windDirection = 0;
      }
    }

    return {
      pressure: level.hPa,
      heightMeters: targetHeight,
      temperature: Math.round(temperature * 10) / 10,
      dewpoint: Math.round(dewpoint * 10) / 10,
      windSpeed: Math.round(windSpeed * 10) / 10,
      windDirection: Math.round(windDirection),
      cloudCover: cloudAtLevel != null ? Math.round(cloudAtLevel) : 0,
      isNative: level.source === 'model',
      source: level.source,
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
  const allLevels = dedupeLevels(getAllTaggedLevelsForModel(model, maxAltitude));

  weatherData.hourly.time.forEach((time, i) => {
    const surfaceTemp = weatherData.hourly.temperature_2m?.[i] ?? 20;
    const surfaceDewpoint = weatherData.hourly.dewpoint_2m?.[i] ?? 15;
    const lclValue = calculateLcl(surfaceTemp, surfaceDewpoint);
    const lclHeight = lclValue + weatherData.elevation;

    const levels = buildLevelDataAtHour({ weatherData, hourIndex: i, levels: allLevels, nativeLevels });
    traces.push({ time, levels, lcl: lclHeight });
  });

  return {
    traces,
    elevation: weatherData.elevation,
    timezoneAbbr: weatherData.timezoneAbbr,
    pressureLevels: allLevels.map((l) => l.hPa),
  };
}
