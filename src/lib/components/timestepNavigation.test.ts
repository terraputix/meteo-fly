import { assert, describe, expect, it } from 'vitest';
import {
  MIN_FORECAST_DAY,
  resolveTimestepHour,
  stepTimestep,
  shortcutMode,
  type TimestepDirection,
  type TimestepMode,
  type TimestepState,
} from '#lib/components/timestepNavigation.js';

function step(
  mode: TimestepMode,
  state: TimestepState,
  direction: TimestepDirection,
  traceCount = 24,
  maxForecastDays = 8
) {
  return stepTimestep({ ...state, mode, direction, traceCount, maxForecastDays });
}

describe('timestep navigation', () => {
  it('steps forecast days without changing the hour and respects day bounds', () => {
    expect(step('day', { selectedDay: 1, hour: 4 }, 1)).toEqual({ selectedDay: 2, hour: 4 });
    expect(step('day', { selectedDay: 8, hour: 0 }, 1)).toBeNull();
    expect(step('day', { selectedDay: MIN_FORECAST_DAY, hour: 0 }, -1)).toBeNull();
  });

  it('steps between traces within a day', () => {
    expect(step('hour', { selectedDay: 1, hour: 4 }, -1)).toEqual({ selectedDay: 1, hour: 3 });
    expect(step('hour', { selectedDay: 1, hour: 4 }, 1)).toEqual({ selectedDay: 1, hour: 5 });
  });

  it('advances to midnight after the last hour of a 23-hour day', () => {
    expect(step('hour', { selectedDay: 1, hour: 22 }, 1, 23)).toEqual({ selectedDay: 2, hour: 0 });
  });

  it('steps back from midnight to the last hour of the previous 25-hour day', () => {
    const destination = step('hour', { selectedDay: 1, hour: 0 }, -1, 24);
    assert(destination);
    expect(destination.selectedDay).toBe(0);
    expect(
      resolveTimestepHour(
        destination.hour,
        Array.from({ length: 25 }, (_, i) => new Date(i * 3600000))
      )
    ).toBe(24);
  });

  it('clamps an hour index when the selected day is shorter', () => {
    expect(
      resolveTimestepHour(
        24,
        Array.from({ length: 23 }, (_, i) => new Date(i * 3600000))
      )
    ).toBe(22);
  });

  it('does not step traces beyond the available days', () => {
    const first = { selectedDay: MIN_FORECAST_DAY, hour: 0 };
    const last = { selectedDay: 8, hour: 23 };

    expect(step('hour', first, -1)).toBeNull();
    expect(step('hour', last, 1)).toBeNull();
  });

  it.each(['ArrowLeft', 'ArrowRight'])('ignores repeated %s in hourly views while the new day loads', (key) => {
    const direction = key === 'ArrowLeft' ? -1 : 1;
    const state = { selectedDay: 2, hour: 0 };
    expect(step(shortcutMode(key, true), state, direction, 0)).toBeNull();
    expect(step(shortcutMode(key, false), state, direction, 0)?.selectedDay).toBe(2 + direction);
  });

  it('resolves a preview against the timestamps returned by the destination day', () => {
    const times = [2, 5, 8].map((hour) => new Date(Date.UTC(2026, 10, 24, hour)));
    expect(resolveTimestepHour(new Date('2026-11-24T05:00Z'), times)).toBe(1);
    expect(resolveTimestepHour(new Date('2026-11-24T07:00Z'), times)).toBe(2);
  });

  it('does not step when trace data is empty', () => {
    const state = { selectedDay: 1, hour: 0 };
    expect(step('hour', state, 1, 0)).toBeNull();
  });
});
