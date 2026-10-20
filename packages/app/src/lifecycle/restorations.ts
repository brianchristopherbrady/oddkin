/**
 * Restorations of this page from the back/forward cache, as observed by running `pageLifecycle()`
 * services. Page-wide, because a restoration is: resources with `revalidateOnRestore` follow it.
 * Importing this module adds no listener; without a running service the count never changes.
 * @internal
 */
import { signal, type Readable } from '@oddkin/core/reactive';

const count = signal(0);
/** The `pageshow` events already counted, so several applications' services count each once. */
const counted = new WeakSet<object>();

export const restorations: Readable<number> = count;

export function noteRestoration(event: object): void {
  if (counted.has(event)) return;
  counted.add(event);
  count.value++;
}
