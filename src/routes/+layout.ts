import { getInitialWeatherMapState } from '$lib/services/weatherMap/url';
import { weatherMapStore } from '$lib/services/weatherMap/store';
import type { LayoutLoad } from './$types';

// This can be false if you're using a fallback (i.e. SPA mode)
export const prerender = true;
export const ssr = false;

export const load: LayoutLoad = ({ url }) => {
  const initialState = getInitialWeatherMapState(url.searchParams);
  weatherMapStore.setInitialState(initialState);

  return {};
};
