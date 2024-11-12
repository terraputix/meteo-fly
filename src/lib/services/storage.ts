const LAST_URL_KEY = 'last-url';

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
