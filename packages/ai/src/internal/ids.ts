let counter = 0;

/** A unique id for client-created records. Hosts may supply their own generator. */
export function createId(prefix = 'id'): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random
    ? `${prefix}-${random}`
    : `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`;
}
