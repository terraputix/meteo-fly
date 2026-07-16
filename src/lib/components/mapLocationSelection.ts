import type { Location } from '$lib/api/types';

export const MAP_DOUBLE_ACTIVATION_INTERVAL_MS = 250;
export const MAP_DOUBLE_ACTIVATION_MAX_DISTANCE_PX = 30;
export const MAP_LOCATION_SELECTION_DELAY_MS = MAP_DOUBLE_ACTIVATION_INTERVAL_MS;

interface MapActivation {
  timestamp: number;
  x: number;
  y: number;
}

export function createMapDoubleActivationRecognizer(
  interval = MAP_DOUBLE_ACTIVATION_INTERVAL_MS,
  maxDistance = MAP_DOUBLE_ACTIVATION_MAX_DISTANCE_PX
) {
  let previous: MapActivation | undefined;

  return {
    register(activation: MapActivation) {
      const isDoubleActivation =
        previous !== undefined &&
        activation.timestamp - previous.timestamp < interval &&
        Math.hypot(activation.x - previous.x, activation.y - previous.y) < maxDistance;

      previous = isDoubleActivation ? undefined : activation;
      return isDoubleActivation;
    },
    reset() {
      previous = undefined;
    },
  };
}

export function createDeferredMapLocationSelection(
  onSelect: (location: Location) => void,
  delay = MAP_LOCATION_SELECTION_DELAY_MS
) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
  }

  return {
    schedule(location: Location) {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        onSelect(location);
      }, delay);
    },
    cancel,
    destroy: cancel,
  };
}
