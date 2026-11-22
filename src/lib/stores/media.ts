import { readable } from 'svelte/store';
import { browser } from '$app/env';

export const isMobile = readable(false, (set) => {
  if (!browser) return;

  const query = window.matchMedia('(width < 40rem)'); // Tailwind's sm breakpoint
  set(query.matches);

  const handler = (e: MediaQueryListEvent) => set(e.matches);
  query.addEventListener('change', handler);

  return () => query.removeEventListener('change', handler);
});
