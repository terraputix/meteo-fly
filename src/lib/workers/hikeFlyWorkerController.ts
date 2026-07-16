import type {
  HikeFlyWorkerComputedData,
  HikeFlyWorkerInput,
  HikeFlyWorkerOutput,
  HikeFlyWorkerRequest,
} from './hikeFlyWorker.types';

export interface HikeFlyWorkerLike {
  onmessage: ((event: MessageEvent<HikeFlyWorkerOutput>) => void) | null;
  onerror: ((error: ErrorEvent) => unknown) | null;
  onmessageerror: ((error: MessageEvent) => unknown) | null;
  postMessage(message: HikeFlyWorkerRequest): void;
  terminate(): void;
}

interface HikeFlyWorkerControllerOptions {
  createWorker: () => HikeFlyWorkerLike;
  removeRenderedResult: () => void;
  renderResult: (data: HikeFlyWorkerComputedData, objectUrl: string) => void;
  onComputingChange: (computing: boolean) => void;
  onHover: (result: {
    point: Extract<HikeFlyWorkerOutput, { type: 'lookup' }>['point'];
    latitude: number;
    longitude: number;
  }) => void;
  onError: (error: unknown) => void;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

export class HikeFlyWorkerController {
  private worker: HikeFlyWorkerLike | null = null;
  private workerBusy = false;
  private requestId = 0;
  private lookupId = 0;
  private objectUrl: string | null = null;
  private destroyed = false;

  constructor(private readonly options: HikeFlyWorkerControllerOptions) {}

  compute(input: HikeFlyWorkerInput): void {
    if (this.destroyed) return;
    const requestId = ++this.requestId;
    this.lookupId++;
    if (this.workerBusy) this.terminateWorker();
    this.worker ??= this.createWorker();
    this.workerBusy = true;
    this.options.onComputingChange(true);

    try {
      this.worker.postMessage({
        type: 'compute',
        requestId,
        input: {
          takeoff: {
            latitude: input.takeoff.latitude,
            longitude: input.takeoff.longitude,
            elevation: input.takeoff.elevation,
          },
          glideRatio: input.glideRatio,
          stepMeters: input.stepMeters,
          tileUrlPattern: input.tileUrlPattern,
        },
      });
    } catch (error) {
      this.handleWorkerError(this.worker, error);
    }
  }

  invalidate(): void {
    if (this.destroyed) return;
    this.requestId++;
    this.lookupId++;
    if (this.workerBusy) this.terminateWorker();
    this.options.onComputingChange(false);
  }

  lookup(latitude: number, longitude: number): void {
    if (this.destroyed || this.workerBusy || !this.worker) return;
    const lookupId = ++this.lookupId;
    this.worker.postMessage({
      type: 'lookup',
      requestId: this.requestId,
      lookupId,
      latitude,
      longitude,
    });
  }

  cancelLookup(): void {
    this.lookupId++;
  }

  clear(): void {
    if (this.destroyed) return;
    this.invalidate();
    this.terminateWorker();
    this.removeCurrentResult();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.clear();
    this.destroyed = true;
  }

  private createWorker(): HikeFlyWorkerLike {
    const worker = this.options.createWorker();
    worker.onmessage = (event) => this.handleWorkerMessage(worker, event.data);
    worker.onerror = (error) => this.handleWorkerError(worker, error);
    worker.onmessageerror = (error) => this.handleWorkerError(worker, error);
    return worker;
  }

  private handleWorkerMessage(source: HikeFlyWorkerLike, response: HikeFlyWorkerOutput): void {
    if (this.destroyed || this.worker !== source || response.requestId !== this.requestId) return;

    if (response.type === 'lookup') {
      if (response.lookupId !== this.lookupId) return;
      this.options.onHover(response);
      return;
    }

    this.workerBusy = false;
    this.options.onComputingChange(false);
    if (!response.success) {
      this.options.onError(response.error);
      return;
    }

    const objectUrl = (this.options.createObjectURL ?? URL.createObjectURL)(response.data.blob);
    try {
      this.removeCurrentResult();
      this.options.renderResult(response.data, objectUrl);
      this.objectUrl = objectUrl;
    } catch (error) {
      try {
        this.options.removeRenderedResult();
      } finally {
        (this.options.revokeObjectURL ?? URL.revokeObjectURL)(objectUrl);
      }
      this.options.onError(error);
    }
  }

  private handleWorkerError(source: HikeFlyWorkerLike, error: unknown): void {
    if (this.worker !== source) return;
    this.terminateWorker();
    if (!this.destroyed) {
      this.options.onComputingChange(false);
      this.options.onError(error);
    }
  }

  private terminateWorker(): void {
    if (!this.worker) return;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    this.worker.terminate();
    this.worker = null;
    this.workerBusy = false;
  }

  private removeCurrentResult(): void {
    const objectUrl = this.objectUrl;
    try {
      this.options.removeRenderedResult();
    } finally {
      if (objectUrl) {
        (this.options.revokeObjectURL ?? URL.revokeObjectURL)(objectUrl);
        this.objectUrl = null;
      }
    }
  }
}
