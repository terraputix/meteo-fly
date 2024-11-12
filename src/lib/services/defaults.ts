import type { Location, WeatherModel } from "$lib/api";
import { getParamsLocalStorage } from "./storage";
import type { PageParameters } from "./types";
import { readURLParams } from "./url";

export const defaultLocation: Location = { latitude: 51.5074, longitude: 0.1278 };
export const defaultWeatherModel: WeatherModel = "icon_seamless";
export const defaultDay = 1;

/// Initial parameters will be first read from the URL, then from local storage.
/// If neither are present, defaults will be used.
export function getInitialParameters(urlParams: URLSearchParams): PageParameters {
    const parsedUrlParams = readURLParams(urlParams);
    if (parsedUrlParams) { return parsedUrlParams; }

    const parsedLocalStorage = getParamsLocalStorage();
    if (parsedLocalStorage) { return parsedLocalStorage; }

    return {
        location: defaultLocation,
        selectedModel: defaultWeatherModel,
        selectedDay: defaultDay
    };
}
