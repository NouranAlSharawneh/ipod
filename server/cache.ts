type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

export async function memo<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;
  const value = await fn();
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

export function invalidate(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
