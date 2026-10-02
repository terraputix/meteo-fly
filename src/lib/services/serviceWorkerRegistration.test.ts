import { describe, expect, it, vi } from 'vitest';
import { observeServiceWorkerRegistration } from './serviceWorkerRegistration';

function createWorker(state: ServiceWorkerState = 'installing') {
  return Object.assign(new EventTarget(), { state, postMessage: vi.fn() }) as unknown as ServiceWorker;
}

function createRegistration() {
  return Object.assign(new EventTarget(), {
    active: null as ServiceWorker | null,
    installing: null as ServiceWorker | null,
    waiting: null as ServiceWorker | null,
  });
}

function setState(worker: ServiceWorker, state: ServiceWorkerState) {
  Object.defineProperty(worker, 'state', { value: state, configurable: true });
  worker.dispatchEvent(new Event('statechange'));
}

function createCallbacks() {
  return { onNeedRefresh: vi.fn(), onOfflineReady: vi.fn() };
}

describe('service worker installation notifications', () => {
  it('prompts for an update already waiting when the app opens without activating it', () => {
    const registration = createRegistration();
    registration.waiting = createWorker('installed');
    const callbacks = createCallbacks();

    observeServiceWorkerRegistration(registration, { controller: null }, callbacks);

    expect(callbacks.onNeedRefresh).toHaveBeenCalledOnce();
    expect(callbacks.onOfflineReady).not.toHaveBeenCalled();
    expect(registration.waiting.postMessage).not.toHaveBeenCalled();
  });

  it('reports offline readiness after the first successful installation', () => {
    const registration = createRegistration();
    const worker = createWorker();
    registration.installing = worker;
    const callbacks = createCallbacks();

    observeServiceWorkerRegistration(registration, { controller: null }, callbacks);
    expect(callbacks.onOfflineReady).not.toHaveBeenCalled();

    registration.waiting = worker;
    setState(worker, 'installed');

    expect(callbacks.onOfflineReady).toHaveBeenCalledOnce();
    expect(callbacks.onNeedRefresh).not.toHaveBeenCalled();
  });

  it('prompts after a discovered update finishes installing', () => {
    const registration = createRegistration();
    registration.active = createWorker('activated');
    const callbacks = createCallbacks();
    observeServiceWorkerRegistration(registration, { controller: registration.active }, callbacks);

    const worker = createWorker();
    registration.installing = worker;
    registration.dispatchEvent(new Event('updatefound'));
    expect(callbacks.onNeedRefresh).not.toHaveBeenCalled();
    setState(worker, 'installed');

    expect(callbacks.onNeedRefresh).toHaveBeenCalledOnce();
    expect(callbacks.onOfflineReady).not.toHaveBeenCalled();
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it('recognizes updates on a page that is not yet controlled', () => {
    const registration = createRegistration();
    registration.active = createWorker('activated');
    registration.installing = createWorker();
    const callbacks = createCallbacks();
    observeServiceWorkerRegistration(registration, { controller: null }, callbacks);

    setState(registration.installing, 'installed');

    expect(callbacks.onNeedRefresh).toHaveBeenCalledOnce();
    expect(callbacks.onOfflineReady).not.toHaveBeenCalled();
  });

  it('ignores failed installations', () => {
    const registration = createRegistration();
    registration.installing = createWorker();
    const callbacks = createCallbacks();
    observeServiceWorkerRegistration(registration, { controller: null }, callbacks);

    setState(registration.installing, 'redundant');

    expect(callbacks.onOfflineReady).not.toHaveBeenCalled();
    expect(callbacks.onNeedRefresh).not.toHaveBeenCalled();
  });

  it('stops observing worker and registration events when disposed', () => {
    const registration = createRegistration();
    registration.installing = createWorker();
    const callbacks = createCallbacks();
    const stop = observeServiceWorkerRegistration(registration, { controller: null }, callbacks);

    stop();
    setState(registration.installing, 'installed');
    registration.installing = createWorker('installed');
    registration.dispatchEvent(new Event('updatefound'));

    expect(callbacks.onOfflineReady).not.toHaveBeenCalled();
    expect(callbacks.onNeedRefresh).not.toHaveBeenCalled();
  });
});
