import { goto } from '$app/navigation';
import type { IControl, Map } from 'maplibre-gl';
import { locationActions } from '$lib/services/location/store';
import type { LocationState } from '$lib/services/location/store';
import type { Location } from '$lib/api/types';

interface BaseControlOptions {
  title: string;
  className: string;
}

interface LocationControlOptions extends BaseControlOptions {
  onLocationDetected?: (location: Location) => void;
}

interface TerrainControlOptions extends BaseControlOptions {
  onToggle?: (enabled: boolean) => void;
  initialEnabled?: boolean;
}

interface AboutControlOptions extends BaseControlOptions {
  url: string;
}

abstract class BaseButtonControl implements IControl {
  protected button!: HTMLButtonElement;
  protected container!: HTMLDivElement;
  protected map?: Map;

  constructor(protected options: BaseControlOptions) {}

  onAdd(map: Map) {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group maplibregl-ctrl-group--floating';

    this.button = document.createElement('button');
    this.button.className = `maplibregl-ctrl-icon ${this.options.className}`;
    this.button.type = 'button';
    this.button.title = this.options.title;
    this.button.setAttribute('aria-label', this.options.title);
    this.button.addEventListener('click', this.handleClick);

    this.container.appendChild(this.button);
    this.render();

    return this.container;
  }

  onRemove() {
    this.button?.removeEventListener('click', this.handleClick);
    this.container?.parentNode?.removeChild(this.container);
    this.map = undefined;
  }

  protected abstract onButtonClick(): void | Promise<void>;
  protected abstract render(): void;

  private handleClick = () => {
    void this.onButtonClick();
  };
}

export class LocationControlManager extends BaseButtonControl {
  constructor(private locationOptions: LocationControlOptions) {
    super(locationOptions);
  }

  protected async onButtonClick() {
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
      this.locationOptions.onLocationDetected?.(state.current);
      this.setButtonState('success', undefined, state.accuracy ?? undefined);
    } else {
      this.setButtonState('idle');
    }
  }

  protected render() {
    this.setButtonState('idle');
  }

  private setButtonState(state: 'idle' | 'loading' | 'error' | 'success', error?: string, accuracy?: number) {
    this.button.disabled = false;
    this.button.classList.remove('loading', 'error', 'success');

    switch (state) {
      case 'loading':
        this.button.innerHTML = this.getLoadingIcon();
        this.button.disabled = true;
        this.button.classList.add('loading');
        this.button.title = 'Detecting location...';
        this.button.setAttribute('aria-label', 'Detecting location');
        break;
      case 'error':
        this.button.innerHTML = this.getErrorIcon();
        this.button.classList.add('error');
        this.button.title = `Error: ${error}. Click to retry.`;
        this.button.setAttribute('aria-label', 'Retry location detection');
        break;
      case 'success':
        this.button.innerHTML = this.getSuccessIcon();
        this.button.classList.add('success');
        this.button.title = `Location detected (±${Math.round(accuracy || 0)}m). Click to refresh.`;
        this.button.setAttribute('aria-label', 'Refresh location');
        break;
      case 'idle':
      default:
        this.button.innerHTML = this.getIdleIcon();
        this.button.title = this.options.title;
        this.button.setAttribute('aria-label', this.options.title);
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

export class TerrainControl extends BaseButtonControl {
  private enabled: boolean;

  constructor(private terrainOptions: TerrainControlOptions) {
    super(terrainOptions);
    this.enabled = terrainOptions.initialEnabled ?? true;
  }

  protected onButtonClick() {
    this.enabled = !this.enabled;
    this.render();
    this.terrainOptions.onToggle?.(this.enabled);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.button) {
      this.render();
    }
  }

  protected render() {
    this.button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 18l6-7 4 5 4-8 4 10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    this.button.classList.toggle('is-active', this.enabled);
    const title = this.enabled ? 'Disable terrain and hillshade' : 'Enable terrain and hillshade';
    this.button.title = title;
    this.button.setAttribute('aria-label', title);
  }
}

export class AboutControl extends BaseButtonControl {
  constructor(private aboutOptions: AboutControlOptions) {
    super(aboutOptions);
  }

  protected onButtonClick() {
    goto(this.aboutOptions.url);
  }

  protected render() {
    this.button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="9" stroke-width="2" />
        <path d="M12 16v-4M12 9h.01" stroke-width="2" stroke-linecap="round" />
      </svg>
    `;
    this.button.title = this.aboutOptions.title;
    this.button.setAttribute('aria-label', this.aboutOptions.title);
  }
}
