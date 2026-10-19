<script lang="ts">
  import type { NavigationItem } from '../../src/models/navigation.js';
  import type { NavigationActionDetail } from '../../src/side-nav/side-nav.js';

  let {
    items,
    onAction,
  }: { items: readonly NavigationItem[]; onAction: (detail: NavigationActionDetail) => void } =
    $props();
</script>

<late-svelte-nav
  label="Primary"
  current="theming"
  {items}
  onodd-action={(e: CustomEvent<NavigationActionDetail>) => onAction(e.detail)}
></late-svelte-nav>
