export type ForecastFailure = { message: string; detail?: string };

export function describeForecastFailure(cause: unknown, message: string, online: boolean): ForecastFailure {
  if (!online) return { message, detail: 'You’re offline. Reconnect and try again.' };

  const reason = cause instanceof Error ? cause.message.replace(/\s+/g, ' ').trim() : '';
  if (cause instanceof TypeError && /failed to fetch|load failed|networkerror|network request failed/i.test(reason)) {
    return { message, detail: 'The browser couldn’t reach Open-Meteo. Check your connection and try again.' };
  }
  if (!reason) return { message };

  const detail = reason.length > 240 ? `${reason.slice(0, 239)}…` : reason;
  return { message, detail };
}
