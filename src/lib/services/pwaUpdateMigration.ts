export const UPDATE_PROMPT_MIGRATION_CACHE = 'pwa-update-prompt-migration-v1';
export const UPDATE_PROMPT_MIGRATION_MARKER = '/__pwa-update-prompt-migrated__';

export async function markUpdatePromptMigration(cacheStorage: Pick<CacheStorage, 'open'>): Promise<boolean> {
  const cache = await cacheStorage.open(UPDATE_PROMPT_MIGRATION_CACHE);
  const marker = await cache.match(UPDATE_PROMPT_MIGRATION_MARKER);
  if (marker) return false;

  await cache.put(UPDATE_PROMPT_MIGRATION_MARKER, new Response(null, { status: 204 }));
  return true;
}
