import type { PageParameters } from './types';

const STORAGE_KEY = 'meteo-fly-params';

export function getParamsLocalStorage(): PageParameters | null {
    if (typeof localStorage === 'undefined') return null;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

export function saveParamsLocalStorage(params: PageParameters): void {
    if (typeof localStorage === 'undefined') return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...params
    }));
}
