import { fromDate } from '@internationalized/date';
import { forecastDayStart } from '#lib/api/api.js';
import { MIN_FORECAST_DAY } from '#lib/components/timestepNavigation.js';

export function buildForecastTimeline(date: Date, timezone: string, day: number, maxDay: number, times?: Date[]) {
  const slots: { day: number; hour: number; time: Date }[] = [];
  const dayStarts: number[] = [];
  const visibleDays = times ? 3 : 7;
  const radius = Math.floor(visibleDays / 2);
  const firstDay = Math.max(MIN_FORECAST_DAY, day - radius - 1);
  const lastDay = Math.min(maxDay, day + radius + 1);
  let start = forecastDayStart(date, timezone, firstDay - day + 1);

  for (let current = firstDay; current <= lastDay; current++) {
    const end = forecastDayStart(date, timezone, current - day + 2);
    dayStarts.push(slots.length);
    if (!times) {
      slots.push({ day: current, hour: 0, time: start });
    } else {
      const hours =
        current === day && times.length
          ? times
          : Array.from(
              { length: Math.ceil((+end - +start) / 3600000) },
              (_, hour) => new Date(+start + hour * 3600000)
            );
      hours.forEach((time, hour) => slots.push({ day: current, hour, time }));
    }
    start = end;
  }

  const innerFirstDay = day - radius;
  const innerDayStarts = dayStarts.filter((index) => Math.abs(slots[index].day - day) <= radius);
  return { slots, dayStarts, visibleDays, innerFirstDay, innerDayStarts };
}

export function dayJumpIndex(
  rail: ReturnType<typeof buildForecastTimeline>,
  start: number,
  selected: number,
  timezone: string
) {
  const end = rail.dayStarts[rail.dayStarts.indexOf(start) + 1] ?? rail.slots.length;
  if (end - start === 1) return start;
  const source = rail.slots[selected];
  const offsetDays = rail.slots[start].day - source.day;
  if (offsetDays === 0) return selected;
  const target = +fromDate(source.time, timezone).add({ days: offsetDays }).toDate();
  let nearest = start;
  for (let i = start + 1; i < end; i++) {
    if (Math.abs(+rail.slots[i].time - target) < Math.abs(+rail.slots[nearest].time - target)) nearest = i;
  }
  return nearest;
}

export function layoutForecastRail(rail: ReturnType<typeof buildForecastTimeline>, edgeWidth: number) {
  const dayWidth = (1 - 2 * edgeWidth) / rail.visibleDays;
  return rail.dayStarts.map((start, i) => {
    const column = rail.slots[start].day - rail.innerFirstDay;
    const left = column < 0 ? 0 : column >= rail.visibleDays ? 1 - edgeWidth : edgeWidth + column * dayWidth;
    const width = column < 0 || column >= rail.visibleDays ? edgeWidth : dayWidth;
    const count = (rail.dayStarts[i + 1] ?? rail.slots.length) - start;
    return { start, count, left, width };
  });
}

export function forecastIndexAt(segments: ReturnType<typeof layoutForecastRail>, fraction: number) {
  const segment = segments.find(({ left, width }) => fraction < left + width) ?? segments[segments.length - 1];
  const index = Math.floor(((fraction - segment.left) / segment.width) * segment.count);
  return segment.start + Math.max(0, Math.min(segment.count - 1, index));
}
