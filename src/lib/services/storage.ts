const LAST_URL_KEY = 'last-url';
const CHART_PANE_CLOSED_KEY = 'meteo-fly-chart-pane-closed';

export type ChartPaneDirection = 'horizontal' | 'vertical';

export function getInitialChartPaneOpen(): boolean {
  try {
    return localStorage.getItem(CHART_PANE_CLOSED_KEY) !== 'true';
  } catch {
    return true;
  }
}

export function saveChartPaneOpen(open: boolean) {
  document.documentElement.toggleAttribute('data-chart-pane-closed', !open);
  try {
    localStorage.setItem(CHART_PANE_CLOSED_KEY, String(!open));
  } catch {
    // The current page keeps the open state when storage is unavailable.
  }
}

export function getInitialChartPaneSize(direction: ChartPaneDirection): number | undefined {
  const size = document.documentElement.style.getPropertyValue(`--saved-chart-pane-${direction}`);
  return size ? Number(size) : undefined;
}

export function saveChartPaneSize(direction: ChartPaneDirection, size: number) {
  try {
    localStorage.setItem(`meteo-fly-chart-pane-${direction}`, String(size));
  } catch {
    // The current page keeps the selected size in memory.
  }
}

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
