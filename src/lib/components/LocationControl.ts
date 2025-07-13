import L from 'leaflet';
import { locationActions } from '$lib/services/location/store';
import type { LocationState } from '$lib/services/location/store';
import type { Location } from '$lib/api/types';

interface LocationControlOptions {
  position?: 'topright' | 'topleft' | 'bottomright' | 'bottomleft';
  onLocationDetected?: (location: Location) => void;
}

export class LocationControlManager {
  private button!: HTMLButtonElement;
  private container!: HTMLDivElement;

  constructor(private options: LocationControlOptions = {}) {}

  createControl() {
    const LocationControl = L.Control.extend({
      options: {
        position: this.options.position || 'topright',
      },
      onAdd: () => {
        this.container = L.DomUtil.create('div', 'leaflet-control-location');
        this.button = L.DomUtil.create('button', 'location-btn', this.container);

        this.button.type = 'button';
        this.button.title = 'Use My Location';
        this.setButtonState('idle');

        L.DomEvent.on(this.button, 'click', this.handleClick.bind(this));
        L.DomEvent.disableClickPropagation(this.container);

        return this.container;
      },
    });

    return new LocationControl();
  }

  private async handleClick() {
    try {
      await locationActions.detectLocation();
    } catch (error) {
      console.error('Location detection failed:', error);
    }
  }

  updateState(state: LocationState) {
    if (!this.button) return;

    if (state.isDetecting) {
      this.setButtonState('loading');
    } else if (state.error) {
      this.setButtonState('error', state.error);
    } else if (state.current) {
      this.setButtonState('success', undefined, state.accuracy ?? undefined);
    } else {
      this.setButtonState('idle');
    }
  }

  private setButtonState(state: 'idle' | 'loading' | 'error' | 'success', error?: string, accuracy?: number) {
    this.button.className = 'location-btn';
    this.button.disabled = false;

    switch (state) {
      case 'loading':
        this.button.innerHTML = this.getLoadingIcon();
        this.button.classList.add('loading');
        this.button.disabled = true;
        this.button.title = 'Detecting location...';
        break;

      case 'error':
        this.button.innerHTML = this.getErrorIcon();
        this.button.classList.add('error');
        this.button.title = `Error: ${error}. Click to retry.`;
        break;

      case 'success':
        this.button.innerHTML = this.getSuccessIcon();
        this.button.classList.add('success');
        this.button.title = `Location detected (±${Math.round(accuracy || 0)}m). Click to refresh.`;
        break;

      case 'idle':
      default:
        this.button.innerHTML = this.getIdleIcon();
        this.button.title = 'Use My Location';
        break;
    }
  }

  private getIdleIcon() {
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="8" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" fill="currentColor"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  private getLoadingIcon() {
    return `
      <svg class="location-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/>
        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
      </svg>
    `;
  }

  private getErrorIcon() {
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="8" stroke-width="2"/>
        <path d="M12 8v4M12 16h.01" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  private getSuccessIcon() {
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="8" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" fill="currentColor"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }
}
