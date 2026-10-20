<script lang="ts">
  // Compile-time test of the opt-in Svelte typings (svelte-check, tooling/framework-types;
  // `npm run typecheck`): no errors here; the expected ones are in Mistakes.svelte.
  import type {} from '@oddkin/components/frameworks/svelte';
  import type {} from '@oddkin/ai/define/prompt-input';
  import type {} from '@oddkin/components/define/input';
  import type {} from '@oddkin/components/define/side-nav';
  import type { NavigationItem } from '@oddkin/components/models';

  let items = $state.raw<readonly NavigationItem[]>([]);
  let name = $state('Ada');
</script>

<odd-side-nav
  label="Primary"
  {items}
  current="overview"
  class="nav"
  onodd-action={(event) => void event.detail.action.trim()}
  onodd-toggle={(event) => event.detail.expanded && event.preventDefault()}
></odd-side-nav>
<odd-input
  label="Name"
  name="name"
  required
  value={name}
  oninput={(event) => (name = event.currentTarget.value)}
></odd-input>
<odd-prompt-input onprompt-submit={(event) => void event.detail.text.trim()}></odd-prompt-input>
