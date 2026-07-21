import { describe, expect, it } from 'vitest';
import type { ChartView } from '$lib/services/types';
import { MIN_FORECAST_DAY, stepTimestep, type TimestepDirection, type TimestepState } from './timestepNavigation';

function step(
  chartView: ChartView,
  state: TimestepState,
  direction: TimestepDirection,
  traceCount = 24,
  maxForecastDays = 8
) {
  return stepTimestep({ ...state, chartView, direction, traceCount, maxForecastDays });
}

describe('timestep navigation', () => {
  it('steps forecast days and clamps them to their bounds', () => {
    expect(step('wind', { selectedDay: 1, hour: 0 }, 1).selectedDay).toBe(2);
    expect(step('wind', { selectedDay: 8, hour: 0 }, 1).selectedDay).toBe(8);
    expect(step('wind', { selectedDay: MIN_FORECAST_DAY, hour: 0 }, -1).selectedDay).toBe(MIN_FORECAST_DAY);
  });

  it('steps between traces within a day', () => {
    expect(step('skewt', { selectedDay: 1, hour: 4 }, -1)).toEqual({ selectedDay: 1, hour: 3 });
    expect(step('skewt', { selectedDay: 1, hour: 4 }, 1)).toEqual({ selectedDay: 1, hour: 5 });
  });

  it('crosses day boundaries when stepping traces', () => {
    expect(step('skewt', { selectedDay: 1, hour: 0 }, -1)).toEqual({ selectedDay: 0, hour: 23 });
    expect(step('skewt', { selectedDay: 1, hour: 23 }, 1)).toEqual({ selectedDay: 2, hour: 0 });
  });

  it('does not step traces beyond the available days', () => {
    const first = { selectedDay: MIN_FORECAST_DAY, hour: 0 };
    const last = { selectedDay: 8, hour: 23 };

    expect(step('skewt', first, -1)).toEqual(first);
    expect(step('skewt', last, 1)).toEqual(last);
  });

  it('does not step when trace data is empty', () => {
    const state = { selectedDay: 1, hour: 0 };
    expect(step('skewt', state, 1, 0)).toEqual(state);
  });

  it('uses the timestep represented by the active chart view', () => {
    expect(
      stepTimestep({
        chartView: 'wind',
        direction: 1,
        selectedDay: 1,
        hour: 4,
        traceCount: 24,
        maxForecastDays: 8,
      })
    ).toEqual({ selectedDay: 2, hour: 4 });
    expect(
      stepTimestep({
        chartView: 'skewt',
        direction: 1,
        selectedDay: 1,
        hour: 4,
        traceCount: 24,
        maxForecastDays: 8,
      })
    ).toEqual({ selectedDay: 1, hour: 5 });
  });
});
