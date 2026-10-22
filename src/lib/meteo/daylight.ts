import { fromDate, toCalendarDate, toZoned } from '@internationalized/date';
import type { WindChartData } from '#lib/api/types.js';

export type DaylightInterval = readonly [start: number, end: number];

export function getDaylightIntervals(
  date: Date,
  { timezone, sunrise, sunset, polarDaylight }: Pick<WindChartData, 'timezone' | 'sunrise' | 'sunset' | 'polarDaylight'>
): DaylightInterval[] {
  const day = toCalendarDate(fromDate(date, timezone));
  const start = +toZoned(day, timezone).toDate();
  const end = +toZoned(day.add({ days: 1 }), timezone).toDate();
  if (polarDaylight === 'day') return [[start, end]];
  if (polarDaylight === 'night' || (!sunrise && !sunset)) return [];

  const rise = sunrise ? +sunrise : start;
  const set = sunset ? +sunset : end;
  const intervals: DaylightInterval[] =
    rise <= set
      ? [[rise, set]]
      : [
          [start, set],
          [rise, end],
        ];
  return intervals
    .map(([from, to]): DaylightInterval => [Math.max(start, from), Math.min(end, to)])
    .filter(([from, to]) => Number.isFinite(from) && Number.isFinite(to) && from < to);
}
