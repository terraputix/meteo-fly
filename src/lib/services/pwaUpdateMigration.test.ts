import { describe, expect, it, vi } from 'vitest';
import {
  markUpdatePromptMigration,
  UPDATE_PROMPT_MIGRATION_CACHE,
  UPDATE_PROMPT_MIGRATION_MARKER,
} from './pwaUpdateMigration';

describe('PWA update prompt migration', () => {
  it('marks the first prompt-capable worker for automatic activation', async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const cacheStorage = {
      open: vi.fn().mockResolvedValue(cache),
    };

    await expect(markUpdatePromptMigration(cacheStorage)).resolves.toBe(true);
    expect(cacheStorage.open).toHaveBeenCalledWith(UPDATE_PROMPT_MIGRATION_CACHE);
    expect(cache.match).toHaveBeenCalledWith(UPDATE_PROMPT_MIGRATION_MARKER);
    expect(cache.put).toHaveBeenCalledWith(UPDATE_PROMPT_MIGRATION_MARKER, expect.any(Response));
  });

  it('leaves later workers waiting for user confirmation', async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
      put: vi.fn(),
    };
    const cacheStorage = {
      open: vi.fn().mockResolvedValue(cache),
    };

    await expect(markUpdatePromptMigration(cacheStorage)).resolves.toBe(false);
    expect(cache.put).not.toHaveBeenCalled();
  });
});
