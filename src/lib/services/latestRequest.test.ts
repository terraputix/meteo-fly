import { describe, expect, it } from 'vitest';
import { createLatestRequest, isAbortError, type RequestHandle } from './latestRequest';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('latest request lifecycle', () => {
  it('allows only the latest request to commit and clear loading', async () => {
    const requests = createLatestRequest();
    const firstResult = deferred<string>();
    const secondResult = deferred<string>();
    let storedResult: string | null = null;
    let loading = true;

    async function run(request: RequestHandle, result: Promise<string>) {
      try {
        const value = await result;
        if (requests.isCurrent(request)) storedResult = value;
      } finally {
        if (requests.isCurrent(request)) {
          loading = false;
          requests.finish(request);
        }
      }
    }

    const firstRequest = requests.start();
    const firstRun = run(firstRequest, firstResult.promise);

    const secondRequest = requests.start();
    const secondRun = run(secondRequest, secondResult.promise);

    expect(firstRequest.signal.aborted).toBe(true);

    firstResult.resolve('first');
    await firstRun;
    expect(storedResult).toBeNull();
    expect(loading).toBe(true);

    secondResult.resolve('second');
    await secondRun;
    expect(storedResult).toBe('second');
    expect(loading).toBe(false);
  });

  it('invalidates an active request when cancelled', () => {
    const requests = createLatestRequest();
    const request = requests.start();

    requests.cancel();

    expect(request.signal.aborted).toBe(true);
    expect(requests.isCurrent(request)).toBe(false);
  });

  it('recognizes abort errors without treating ordinary errors as aborts', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true);
    expect(isAbortError(new Error('Failed'))).toBe(false);
  });

  it('allows only the current non-aborted request to commit a failure', async () => {
    const requests = createLatestRequest();
    const firstResult = deferred<string>();
    const secondResult = deferred<string>();
    let error: string | null = null;

    async function run(request: RequestHandle, result: Promise<string>) {
      try {
        await result;
      } catch (err) {
        if (requests.isCurrent(request) && !isAbortError(err)) {
          error = 'Failed';
        }
      }
    }

    const firstRequest = requests.start();
    const firstRun = run(firstRequest, firstResult.promise);
    const secondRequest = requests.start();
    const secondRun = run(secondRequest, secondResult.promise);

    firstResult.reject(new Error('Stale failure'));
    await firstRun;
    expect(error).toBeNull();

    secondResult.reject(new Error('Current failure'));
    await secondRun;
    expect(error).toBe('Failed');
  });

  it('does not commit an abort as a request failure', async () => {
    const requests = createLatestRequest();
    const result = deferred<string>();
    let error: string | null = null;
    const request = requests.start();

    const run = result.promise.catch((err: unknown) => {
      if (requests.isCurrent(request) && !isAbortError(err)) {
        error = 'Failed';
      }
    });

    result.reject(new DOMException('Aborted', 'AbortError'));
    await run;

    expect(error).toBeNull();
  });

  it('clears a failure when a retry generation succeeds', async () => {
    const requests = createLatestRequest();
    let error: string | null = 'Failed';
    let result: string | null = null;
    const retryResult = deferred<string>();

    const request = requests.start();
    expect(error).toBe('Failed');
    error = null;

    const run = retryResult.promise.then((value) => {
      if (requests.isCurrent(request)) {
        result = value;
      }
    });

    retryResult.resolve('forecast');
    await run;

    expect(error).toBeNull();
    expect(result).toBe('forecast');
  });
});
