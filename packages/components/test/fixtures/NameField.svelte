<script lang="ts">
  import type { OddkinInput } from '../../src/input/input.js';

  let { initial }: { initial: string } = $props();

  // Svelte 5 allows bind:value only on native form controls: a value property in, input out.
  let name = $state(initial);

  export const read = () => name;
  export const write = (next: string) => (name = next);
</script>

<form>
  <odd-input
    label="Name"
    name="name"
    required
    value={name}
    oninput={(e: Event) => (name = (e.currentTarget as OddkinInput).value)}
  ></odd-input>
</form>
