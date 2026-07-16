const LAST_URL_KEY = 'last-url';

export function buildVisitedURL(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function saveLastVisitedURL(url: string) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LAST_URL_KEY, url);
  }
}

export function getLastVisitedURL(): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(LAST_URL_KEY);
  }
  return null;
}
