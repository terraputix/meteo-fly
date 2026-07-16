export interface RequestHandle {
  generation: number;
  signal: AbortSignal;
}

export function createLatestRequest() {
  let generation = 0;
  let controller: AbortController | null = null;

  return {
    start(): RequestHandle {
      controller?.abort();
      controller = new AbortController();
      generation += 1;
      return { generation, signal: controller.signal };
    },
    isCurrent(request: RequestHandle): boolean {
      return request.generation === generation && !request.signal.aborted;
    },
    finish(request: RequestHandle): boolean {
      if (request.generation !== generation || request.signal.aborted) return false;
      controller = null;
      return true;
    },
    cancel(): void {
      generation += 1;
      controller?.abort();
      controller = null;
    },
  };
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}
