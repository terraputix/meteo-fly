import { readable } from 'svelte/store';
import { browser } from '$app/environment';

export const isMobile = readable(false, (set) => {
  if (!browser) return;

  const query = window.matchMedia('(max-width: 639px)'); // Tailwind's 'sm' breakpoint is 640px
  set(query.matches);

  const handler = (e: MediaQueryListEvent) => set(e.matches);
  query.addEventListener('change', handler);

  return () => query.removeEventListener('change', handler);
});
