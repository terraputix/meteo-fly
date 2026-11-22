import { readable } from 'svelte/store';
import { browser } from '$app/env';

const query = browser ? window.matchMedia('(width < 40rem)') : null; // Tailwind's sm breakpoint

export const matchesMobileViewport = () => query?.matches ?? false;

export const isMobile = readable(false, (set) => {
  if (!query) return;
  set(query.matches);

  const handler = (e: MediaQueryListEvent) => set(e.matches);
  query.addEventListener('change', handler);

  return () => query.removeEventListener('change', handler);
});
