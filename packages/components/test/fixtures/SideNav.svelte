<script lang="ts">
  import type { NavigationItem } from '../../src/models/navigation.js';
  import type { NavigationActionDetail, NavigationToggleDetail } from '../../src/side-nav/side-nav.js';

  interface Props {
    initial: readonly NavigationItem[];
    current?: string;
    controlled?: boolean;
    onToggle?: (detail: NavigationToggleDetail) => void;
    onAction?: (detail: NavigationActionDetail) => void;
  }
  let { initial, current = '', controlled = true, onToggle, onAction }: Props = $props();

  // $state.raw hands the element the arrays themselves; $state would pass deep proxies.
  let items = $state.raw(initial);
  let expanded = $state.raw<readonly string[]>([]);
  let shown = $state(true);

  export const setItems = (next: readonly NavigationItem[]) => (items = next);
  export const setShown = (next: boolean) => (shown = next);
</script>

{#if shown}
  <odd-side-nav
    label="Primary"
    {items}
    {current}
    expanded={controlled ? expanded : undefined}
    onodd-toggle={(e: CustomEvent<NavigationToggleDetail>) => {
      onToggle?.(e.detail);
      expanded = e.detail.expanded ? [e.detail.id] : [];
    }}
    onodd-action={(e: CustomEvent<NavigationActionDetail>) => onAction?.(e.detail)}
  ></odd-side-nav>
{/if}
