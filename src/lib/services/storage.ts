import type { Location, WeatherModel } from '$lib/api';

interface StoredParameters {
    location: Location;
    selectedDay: number;
    selectedModel: WeatherModel;
    lastUpdated: string;
}

const STORAGE_KEY = 'meteo-fly-params';

export function loadStoredParameters(): StoredParameters | null {
    if (typeof localStorage === 'undefined') return null;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

export function saveParameters(params: StoredParameters): void {
    if (typeof localStorage === 'undefined') return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...params,
        lastUpdated: new Date().toISOString()
    }));
}
