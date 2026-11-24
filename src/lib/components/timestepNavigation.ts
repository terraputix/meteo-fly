export const MIN_FORECAST_DAY = -13;

export type TimestepDirection = -1 | 1;
export type TimestepMode = 'day' | 'hour';

export interface TimestepState {
  selectedDay: number;
  hour: number;
}

type TimestepTarget = Omit<TimestepState, 'hour'> & { hour: number | 'last' };

interface StepTimestepOptions extends TimestepState {
  mode: TimestepMode;
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
): TimestepTarget | null {
  if (traceCount <= 0) return null;

  if (direction === -1) {
    if (state.hour > 0) return { selectedDay: state.selectedDay, hour: state.hour - 1 };
    if (state.selectedDay <= MIN_FORECAST_DAY) return null;
    return { selectedDay: state.selectedDay - 1, hour: 'last' };
  }

  if (state.hour < traceCount - 1) return { selectedDay: state.selectedDay, hour: state.hour + 1 };
  if (state.selectedDay >= maxForecastDays) return null;
  return { selectedDay: state.selectedDay + 1, hour: 0 };
}

export function stepTimestep(options: StepTimestepOptions): TimestepTarget | null {
  if (options.mode === 'day') {
    const selectedDay = stepDay(options.selectedDay, options.direction, options.maxForecastDays);
    return selectedDay === options.selectedDay ? null : { selectedDay, hour: options.hour };
  }

  return stepTrace(options, options.direction, options.traceCount, options.maxForecastDays);
}

export function shortcutMode(key: string, showHours: boolean): TimestepMode {
  return showHours && (key === 'ArrowLeft' || key === 'ArrowRight') ? 'hour' : 'day';
}

export function resolveTimestepHour(hour: TimestepTarget['hour'] | Date, times: Date[]): number {
  if (hour instanceof Date) {
    return times.reduce(
      (nearest, time, i) => (Math.abs(+time - +hour) < Math.abs(+times[nearest] - +hour) ? i : nearest),
      0
    );
  }
  return hour === 'last' ? times.length - 1 : Math.min(hour, times.length - 1);
}
