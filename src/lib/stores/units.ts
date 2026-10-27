import { writable } from 'svelte/store';
import { METRIC_UNITS, parseUnits, type UnitPreferences } from '#lib/utils/units.js';

const key = 'meteo-fly-units';
function readUnits(): UnitPreferences {
  try {
    return typeof localStorage === 'undefined'
      ? METRIC_UNITS
      : parseUnits(JSON.parse(localStorage.getItem(key) ?? 'null'));
  } catch {
    return METRIC_UNITS;
  }
}
export const units = writable<UnitPreferences>(readUnits());
units.subscribe((value) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preferences still work when browser storage is unavailable.
  }
});
