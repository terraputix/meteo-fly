export function fmtTime(d: Date, timeZone: string, includeZone = false): string {
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
    timeZoneName: includeZone ? 'shortOffset' : undefined,
  });
}

export function formatTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')!.value;
}
