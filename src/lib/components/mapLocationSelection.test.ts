import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDeferredMapLocationSelection,
  createMapDoubleActivationRecognizer,
  MAP_DOUBLE_ACTIVATION_INTERVAL_MS,
  MAP_LOCATION_SELECTION_DELAY_MS,
} from './mapLocationSelection';

describe('map double activation recognition', () => {
  it('recognizes nearby activations within 250ms', () => {
    const recognizer = createMapDoubleActivationRecognizer();

    expect(recognizer.register({ timestamp: 1000, x: 20, y: 30 })).toBe(false);
    expect(
      recognizer.register({
        timestamp: 1000 + MAP_DOUBLE_ACTIVATION_INTERVAL_MS - 1,
        x: 25,
        y: 35,
      })
    ).toBe(true);
  });

  it('does not recognize activations at or beyond 250ms', () => {
    const recognizer = createMapDoubleActivationRecognizer();

    expect(recognizer.register({ timestamp: 1000, x: 20, y: 30 })).toBe(false);
    expect(
      recognizer.register({
        timestamp: 1000 + MAP_DOUBLE_ACTIVATION_INTERVAL_MS,
        x: 20,
        y: 30,
      })
    ).toBe(false);
  });

  it('does not recognize activations more than 30px apart', () => {
    const recognizer = createMapDoubleActivationRecognizer();

    expect(recognizer.register({ timestamp: 1000, x: 20, y: 30 })).toBe(false);
    expect(recognizer.register({ timestamp: 1100, x: 51, y: 30 })).toBe(false);
  });

  it('can reset a pending activation', () => {
    const recognizer = createMapDoubleActivationRecognizer();

    recognizer.register({ timestamp: 1000, x: 20, y: 30 });
    recognizer.reset();

    expect(recognizer.register({ timestamp: 1100, x: 20, y: 30 })).toBe(false);
  });
});

describe('deferred map location selection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('commits a single selection after the double-activation window', () => {
    const onSelect = vi.fn();
    const selection = createDeferredMapLocationSelection(onSelect);
    const location = { latitude: 46.8, longitude: 8.2 };

    selection.schedule(location);
    vi.advanceTimersByTime(MAP_LOCATION_SELECTION_DELAY_MS - 1);
    expect(onSelect).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(location);
  });

  it('keeps only the latest pending selection', () => {
    const onSelect = vi.fn();
    const selection = createDeferredMapLocationSelection(onSelect);
    const first = { latitude: 46.8, longitude: 8.2 };
    const second = { latitude: 47.1, longitude: 8.6 };

    selection.schedule(first);
    vi.advanceTimersByTime(100);
    selection.schedule(second);
    vi.advanceTimersByTime(MAP_LOCATION_SELECTION_DELAY_MS);

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(second);
  });

  it('cancels a pending double-click or double-tap selection', () => {
    const onSelect = vi.fn();
    const selection = createDeferredMapLocationSelection(onSelect);

    selection.schedule({ latitude: 46.8, longitude: 8.2 });
    vi.advanceTimersByTime(100);
    selection.schedule({ latitude: 46.8, longitude: 8.2 });
    selection.cancel();
    vi.runAllTimers();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clears pending work when destroyed', () => {
    const onSelect = vi.fn();
    const selection = createDeferredMapLocationSelection(onSelect);

    selection.schedule({ latitude: 46.8, longitude: 8.2 });
    selection.destroy();
    vi.runAllTimers();

    expect(onSelect).not.toHaveBeenCalled();
  });
});
