import { describe, expect, it } from 'vitest';
import { MIN_FORECAST_DAY, stepTimestep, type TimestepDirection, type TimestepState } from './timestepNavigation';

function step(
  mode: 'day' | 'hour',
  state: TimestepState,
  direction: TimestepDirection,
  traceCount = 24,
  maxForecastDays = 8
) {
  return stepTimestep({ ...state, mode, direction, traceCount, maxForecastDays });
}

describe('timestep navigation', () => {
  it('steps forecast days and clamps them to their bounds', () => {
    expect(step('day', { selectedDay: 1, hour: 0 }, 1).selectedDay).toBe(2);
    expect(step('day', { selectedDay: 8, hour: 0 }, 1).selectedDay).toBe(8);
    expect(step('day', { selectedDay: MIN_FORECAST_DAY, hour: 0 }, -1).selectedDay).toBe(MIN_FORECAST_DAY);
  });

  it('steps between traces within a day', () => {
    expect(step('hour', { selectedDay: 1, hour: 4 }, -1)).toEqual({ selectedDay: 1, hour: 3 });
    expect(step('hour', { selectedDay: 1, hour: 4 }, 1)).toEqual({ selectedDay: 1, hour: 5 });
  });

  it('crosses day boundaries when stepping traces', () => {
    expect(step('hour', { selectedDay: 1, hour: 0 }, -1)).toEqual({ selectedDay: 0, hour: 23 });
    expect(step('hour', { selectedDay: 1, hour: 23 }, 1)).toEqual({ selectedDay: 2, hour: 0 });
  });

  it('does not step traces beyond the available days', () => {
    const first = { selectedDay: MIN_FORECAST_DAY, hour: 0 };
    const last = { selectedDay: 8, hour: 23 };

    expect(step('hour', first, -1)).toEqual(first);
    expect(step('hour', last, 1)).toEqual(last);
  });

  it('does not step when trace data is empty', () => {
    const state = { selectedDay: 1, hour: 0 };
    expect(step('hour', state, 1, 0)).toEqual(state);
  });

  it.each([23, 24, 25])('advances at the end of a %i-hour day', (count) => {
    expect(step('hour', { selectedDay: 1, hour: count - 1 }, 1, count)).toEqual({ selectedDay: 2, hour: 0 });
  });

  it('supports separate day and hour controls', () => {
    expect(
      stepTimestep({
        mode: 'day',
        direction: 1,
        selectedDay: 1,
        hour: 4,
        traceCount: 24,
        maxForecastDays: 8,
      })
    ).toEqual({ selectedDay: 2, hour: 4 });
    expect(
      stepTimestep({
        mode: 'hour',
        direction: 1,
        selectedDay: 1,
        hour: 4,
        traceCount: 24,
        maxForecastDays: 8,
      })
    ).toEqual({ selectedDay: 1, hour: 5 });
  });
});
