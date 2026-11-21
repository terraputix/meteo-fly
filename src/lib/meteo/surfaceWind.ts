import { EARTH_RADIUS, toRadians } from '#lib/meteo/hikeAndFly.js';
import { windDirectionLabel } from '#lib/meteo/wind.js';
import { windSpeed, type UnitPreferences } from '#lib/utils/units.js';

export function windBearing(speed: number, direction: number) {
  return speed !== 0 && Number.isFinite(direction) ? ((direction % 360) + 360) % 360 : null;
}

export function describeSurfaceWind(speed: number, direction: number, gust: number, units: UnitPreferences) {
  const bearing = windBearing(speed, direction);
  const format = (value: number) =>
    Number.isFinite(value) ? `${Math.round(windSpeed(value, units))} ${units.wind}` : '—';
  const from = bearing === null ? '' : `From ${windDirectionLabel(bearing)} ${Math.round(bearing) % 360}° · `;
  return { bearing, wind: speed === 0 ? 'Calm' : from + format(speed), gust: format(gust) };
}

export const WIND_COMPASS_RADIUS_METERS = 2000;

export function windCompassRimPoint(latitude: number, longitude: number, bearing: number): [number, number] {
  const distance = WIND_COMPASS_RADIUS_METERS / EARTH_RADIUS;
  const lat = toRadians(latitude);
  const angle = toRadians(bearing);
  const rimLat = Math.asin(
    Math.max(-1, Math.min(1, Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(angle)))
  );
  const deltaLon = Math.atan2(
    Math.sin(angle) * Math.sin(distance) * Math.cos(lat),
    Math.cos(distance) - Math.sin(lat) * Math.sin(rimLat)
  );
  return [longitude + (deltaLon * 180) / Math.PI, (rimLat * 180) / Math.PI];
}
