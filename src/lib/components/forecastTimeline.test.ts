import { describe, expect, it } from 'vitest';
import {
  buildForecastTimeline,
  dayJumpIndex,
  forecastIndexAt,
  layoutForecastRail,
} from '#lib/components/forecastTimeline.js';

describe('forecast timeline', () => {
  it.each([
    ['2026-03-29', 23],
    ['2026-10-25', 25],
  ] as const)('places day ticks around the local clock change on %s', (date, length) => {
    const { slots, dayStarts } = buildForecastTimeline(new Date(date + 'T12:00Z'), 'Europe/Zurich', 1, 2, []);
    const day = slots.filter((slot) => slot.day === 1);
    expect(day).toHaveLength(length);
    expect(+day[1].time - +day[0].time).toBe(3600000);
    expect(dayStarts.slice(-2)).toEqual([slots.indexOf(day[0]), slots.indexOf(day[0]) + length]);
  });

  it.each([true, false])('keeps the active day centered even at forecast limits (hourly: %s)', (hourly) => {
    for (const day of [-13, -12, 0, 1, 7, 8]) {
      const rail = buildForecastTimeline(new Date('2026-11-24T12:00Z'), 'UTC', day, 8, hourly ? [] : undefined);
      const days = rail.dayStarts.map((start) => rail.slots[start].day);
      expect(day - rail.innerFirstDay).toBe(Math.floor(rail.visibleDays / 2));
      expect(rail.innerDayStarts.length).toBeLessThanOrEqual(rail.visibleDays);
      expect(Math.min(...days)).toBeGreaterThanOrEqual(-13);
      expect(Math.max(...days)).toBeLessThanOrEqual(8);
    }
  });

  it('shows seven individually selectable dates for a daily chart', () => {
    const { slots, innerDayStarts } = buildForecastTimeline(new Date('2026-11-24T12:00Z'), 'UTC', 1, 8);
    expect(innerDayStarts.map((index) => slots[index].day)).toEqual([-2, -1, 0, 1, 2, 3, 4]);
    expect(slots.map((slot) => slot.day)).toEqual([-3, -2, -1, 0, 1, 2, 3, 4, 5]);
  });

  it.each([
    ['2026-03-28T11:00:00Z', '2026-03-29T10:00:00Z'],
    ['2026-10-24T10:00:00Z', '2026-10-25T11:00:00Z'],
  ])('jumps to the same local time across a clock change from %s', (from, to) => {
    const rail = buildForecastTimeline(new Date(from), 'Europe/Zurich', 1, 8, []);
    const selected = rail.slots.findIndex((slot) => +slot.time === Date.parse(from));
    expect(rail.slots[dayJumpIndex(rail, rail.innerDayStarts[2], selected, 'Europe/Zurich')].time).toEqual(
      new Date(to)
    );
  });

  it.each([0.08, 0.2])('reserves the arrow widths for adjacent days at width fraction %s', (edge) => {
    const rail = buildForecastTimeline(new Date('2026-10-25T12:00Z'), 'Europe/Zurich', 1, 8, []);
    const segments = layoutForecastRail(rail, edge);
    const dayAt = (fraction: number) => rail.slots[forecastIndexAt(segments, fraction)].day;
    expect(rail.innerDayStarts.map((start) => rail.slots[start].day)).toEqual([0, 1, 2]);
    expect([edge / 2, edge + 0.001, 0.5, 1 - edge - 0.001, 1 - edge / 2].map(dayAt)).toEqual([-1, 0, 1, 2, 3]);
    for (const { start, count, left, width } of segments) {
      for (let i = 0; i < count; i++) {
        expect(forecastIndexAt(segments, left + ((i + 0.5) * width) / count)).toBe(start + i);
      }
    }
  });

  it('uses the loaded timestamps and their original indices for the active day', () => {
    const times = [new Date('2026-11-24T02:00Z'), new Date('2026-11-24T05:00Z')];
    const { slots } = buildForecastTimeline(times[0], 'UTC', 1, 1, times);
    expect(slots.filter((slot) => slot.day === 1)).toEqual(times.map((time, hour) => ({ day: 1, hour, time })));
  });
});
