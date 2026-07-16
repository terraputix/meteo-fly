import { describe, expect, it } from 'vitest';
import { createLatestRequest, isAbortError, type RequestHandle } from './latestRequest';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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
});
