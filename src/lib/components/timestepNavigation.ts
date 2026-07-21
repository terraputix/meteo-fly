import type { ChartView } from '$lib/services/types';

export const MIN_FORECAST_DAY = -13;

export type TimestepDirection = -1 | 1;

export interface TimestepState {
  selectedDay: number;
  hour: number;
}

interface StepTimestepOptions extends TimestepState {
  chartView: ChartView;
  direction: TimestepDirection;
  traceCount: number;
  maxForecastDays: number;
}

function stepDay(selectedDay: number, direction: TimestepDirection, maxForecastDays: number): number {
  return Math.min(maxForecastDays, Math.max(MIN_FORECAST_DAY, selectedDay + direction));
}

function stepTrace(
  state: TimestepState,
  direction: TimestepDirection,
  traceCount: number,
  maxForecastDays: number
): TimestepState {
  const current = { selectedDay: state.selectedDay, hour: state.hour };
  if (traceCount <= 0) return current;

  if (direction === -1) {
    if (state.hour > 0) return { selectedDay: state.selectedDay, hour: state.hour - 1 };
    if (state.selectedDay <= MIN_FORECAST_DAY) return current;
    return { selectedDay: state.selectedDay - 1, hour: traceCount - 1 };
  }

  if (state.hour < traceCount - 1) return { selectedDay: state.selectedDay, hour: state.hour + 1 };
  if (state.selectedDay >= maxForecastDays) return current;
  return { selectedDay: state.selectedDay + 1, hour: 0 };
}

export function stepTimestep(options: StepTimestepOptions): TimestepState {
  if (options.chartView === 'wind') {
    return {
      selectedDay: stepDay(options.selectedDay, options.direction, options.maxForecastDays),
      hour: options.hour,
    };
  }

  return stepTrace(options, options.direction, options.traceCount, options.maxForecastDays);
}
