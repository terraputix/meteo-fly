import { describe, expect, it, vi } from 'vitest';
import { HikeFlyWorkerController, type HikeFlyWorkerLike } from './hikeFlyWorkerController';
import type {
  HikeFlyWorkerComputedData,
  HikeFlyWorkerInput,
  HikeFlyWorkerOutput,
  HikeFlyWorkerRequest,
} from './hikeFlyWorker.types';

class FakeWorker implements HikeFlyWorkerLike {
  onmessage: ((event: MessageEvent<HikeFlyWorkerOutput>) => void) | null = null;
  onerror: ((error: ErrorEvent) => unknown) | null = null;
  onmessageerror: ((error: MessageEvent) => unknown) | null = null;
  messages: HikeFlyWorkerRequest[] = [];
  terminated = false;

  postMessage(message: HikeFlyWorkerRequest): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(message: HikeFlyWorkerOutput): void {
    this.onmessage?.({ data: message } as MessageEvent<HikeFlyWorkerOutput>);
  }
}

const input: HikeFlyWorkerInput = {
  takeoff: { latitude: 47, longitude: 8, elevation: 1_000 },
  glideRatio: 8,
  stepMeters: 100,
  tileUrlPattern: 'https://example.com/{z}/{x}/{y}.png',
};

const data: HikeFlyWorkerComputedData = {
  blob: new Blob(),
  coordinates: [
    [7, 48],
    [9, 48],
    [9, 46],
    [7, 46],
  ],
};

function success(requestId: number): HikeFlyWorkerOutput {
  return { type: 'computed', requestId, success: true, data };
}

function createHarness(renderResult: (result: HikeFlyWorkerComputedData, url: string) => void = vi.fn()) {
  const workers: FakeWorker[] = [];
  const events: string[] = [];
  let urlSequence = 0;
  const onHover = vi.fn();
  const onError = vi.fn();
  const controller = new HikeFlyWorkerController({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    removeRenderedResult: () => events.push('remove'),
    renderResult: (result, url) => {
      events.push(`render:${url}`);
      renderResult(result, url);
    },
    onComputingChange: vi.fn(),
    onHover,
    onError,
    createObjectURL: () => `blob:${++urlSequence}`,
    revokeObjectURL: (url) => events.push(`revoke:${url}`),
  });
  return { controller, workers, events, onHover, onError, renderResult };
}

describe('HikeFlyWorkerController', () => {
  it('normalizes reactive proxy input before posting it to the worker', () => {
    const harness = createHarness();
    const proxiedInput = new Proxy(
      {
        ...input,
        takeoff: new Proxy(input.takeoff, {}),
      },
      {}
    );

    harness.controller.compute(proxiedInput);

    const request = harness.workers[0].messages[0];
    expect(() => structuredClone(request)).not.toThrow();
    expect(request).toMatchObject({ type: 'compute', input });
    if (request.type === 'compute') expect(request.input.takeoff).not.toBe(proxiedInput.takeoff);
  });

  it('terminates in-progress work and renders only the latest generation', () => {
    const harness = createHarness();
    harness.controller.compute(input);
    const firstWorker = harness.workers[0];
    const staleHandler = firstWorker.onmessage;

    harness.controller.compute({ ...input, glideRatio: 10 });
    const secondWorker = harness.workers[1];
    expect(firstWorker.terminated).toBe(true);

    staleHandler?.({ data: success(1) } as MessageEvent<HikeFlyWorkerOutput>);
    secondWorker.emit(success(2));

    expect(harness.renderResult).toHaveBeenCalledTimes(1);
    expect(harness.events).toEqual(['remove', 'render:blob:1']);
  });

  it('ignores stale hover responses', () => {
    const harness = createHarness();
    harness.controller.compute(input);
    const worker = harness.workers[0];
    worker.emit(success(1));

    harness.controller.lookup(47.1, 8.1);
    harness.controller.lookup(47.2, 8.2);
    const lookupRequests = worker.messages.filter(
      (message): message is Extract<HikeFlyWorkerRequest, { type: 'lookup' }> => message.type === 'lookup'
    );
    const point = { latitude: 47, longitude: 8, distance: 0, terrainElevation: 500, heightAGL: 100 };
    worker.emit({ ...lookupRequests[0], point });
    worker.emit({ ...lookupRequests[1], point });

    expect(harness.onHover).toHaveBeenCalledTimes(1);
    expect(harness.onHover).toHaveBeenCalledWith(expect.objectContaining({ latitude: 47.2, longitude: 8.2 }));
  });

  it('removes map sources before revoking URLs on replacement and clear', () => {
    const harness = createHarness();
    harness.controller.compute(input);
    const worker = harness.workers[0];
    worker.emit(success(1));
    harness.controller.compute({ ...input, stepMeters: 50 });
    worker.emit(success(2));
    harness.controller.clear();
    harness.controller.clear();

    expect(harness.events).toEqual([
      'remove',
      'render:blob:1',
      'remove',
      'revoke:blob:1',
      'render:blob:2',
      'remove',
      'revoke:blob:2',
      'remove',
    ]);
  });

  it('cleans up a new URL when map rendering fails', () => {
    const harness = createHarness(() => {
      throw new Error('render failed');
    });
    harness.controller.compute(input);
    harness.workers[0].emit(success(1));

    expect(harness.events).toEqual(['remove', 'render:blob:1', 'remove', 'revoke:blob:1']);
    expect(harness.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'render failed' }));
  });

  it('terminates the worker and revokes the rendered URL on destruction', () => {
    const harness = createHarness();
    harness.controller.compute(input);
    const worker = harness.workers[0];
    worker.emit(success(1));

    harness.controller.destroy();

    expect(worker.terminated).toBe(true);
    expect(harness.events.slice(-2)).toEqual(['remove', 'revoke:blob:1']);
  });
});
