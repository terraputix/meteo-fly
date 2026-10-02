interface InstallationCallbacks {
  onNeedRefresh: () => void;
  onOfflineReady: () => void;
}

export function observeServiceWorkerRegistration(
  registration: Pick<ServiceWorkerRegistration, 'active' | 'installing' | 'waiting'> & EventTarget,
  container: Pick<ServiceWorkerContainer, 'controller'>,
  callbacks: InstallationCallbacks
): () => void {
  let worker: ServiceWorker | null = null;

  function handleStateChange() {
    if (worker?.state !== 'installed') return;
    if (registration.active || container.controller) {
      callbacks.onNeedRefresh();
    } else {
      callbacks.onOfflineReady();
    }
  }

  function watchInstallation() {
    worker?.removeEventListener('statechange', handleStateChange);
    worker = registration.installing;
    worker?.addEventListener('statechange', handleStateChange);
    handleStateChange();
  }

  registration.addEventListener('updatefound', watchInstallation);
  if (registration.waiting) callbacks.onNeedRefresh();
  watchInstallation();

  return () => {
    registration.removeEventListener('updatefound', watchInstallation);
    worker?.removeEventListener('statechange', handleStateChange);
  };
}
