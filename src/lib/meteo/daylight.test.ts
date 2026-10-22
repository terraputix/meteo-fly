import { describe, expect, it } from 'vitest';
import { getDaylightIntervals } from '#lib/meteo/daylight.js';

const date = new Date('2026-07-16T12:00Z');
const hour = (value: number) => Date.parse('2026-07-16T00:00Z') + value * 3600000;

describe('local-day daylight intervals', () => {
  it.each([
    ['ordinary day', 6, 18, [[6, 18]]],
    [
      'sunset before sunrise',
      18,
      6,
      [
        [0, 6],
        [18, 24],
      ],
    ],
    ['sunrise only', 6, null, [[6, 24]]],
    ['sunset only', null, 18, [[0, 18]]],
    ['unknown solar events', null, null, []],
  ] as const)('handles %s', (_name, rise, set, expected) => {
    expect(
      getDaylightIntervals(date, {
        timezone: 'UTC',
        sunrise: rise === null ? null : new Date(hour(rise)),
        sunset: set === null ? null : new Date(hour(set)),
      })
    ).toEqual(expected.map(([start, end]) => [hour(start), hour(end)]));
  });

  it.each([
    ['2026-03-29T12:00Z', '2026-03-28T23:00Z', '2026-03-29T22:00Z', 23],
    ['2026-10-25T12:00Z', '2026-10-24T22:00Z', '2026-10-25T23:00Z', 25],
  ])('uses calendar midnights across DST on %s', (day, start, end, hours) => {
    const options = { timezone: 'Europe/Berlin', sunrise: null, sunset: null };
    const intervals = getDaylightIntervals(new Date(day), { ...options, polarDaylight: 'day' });
    expect(intervals).toEqual([[Date.parse(start), Date.parse(end)]]);
    expect(intervals[0][1] - intervals[0][0]).toBe(Number(hours) * 3600000);
    expect(getDaylightIntervals(new Date(day), { ...options, polarDaylight: 'night' })).toEqual([]);
  });

  it('clips events to the selected day', () => {
    expect(
      getDaylightIntervals(date, {
        timezone: 'UTC',
        sunrise: new Date(hour(-1)),
        sunset: new Date(hour(25)),
      })
    ).toEqual([[hour(0), hour(24)]]);
  });
});
