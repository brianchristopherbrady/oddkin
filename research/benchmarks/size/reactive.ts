// The DOM-free reactive graph alone (e.g. for @mote/state or non-DOM code).
import { batch, computed, effect, signal } from '@mote/core/reactive';

const a = signal(1);
const b = computed(() => a.value * 2);
effect(() => {
  globalThis.console.log(b.value);
});
batch(() => {
  a.value = 2;
});
