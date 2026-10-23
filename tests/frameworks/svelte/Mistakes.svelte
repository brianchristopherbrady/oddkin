<script lang="ts">
  // Expected errors for the Svelte typings: svelte-check does not honour @ts-expect-error in
  // markup, so `scripts/check-framework-types.mjs` requires exactly the errors listed in
  // `mistakes.expected.json` here, and none in Shell.svelte.
  import type {} from '@oddkin/components/frameworks/svelte';
  import type {} from '@oddkin/ai/define/prompt-input';
  import type {} from '@oddkin/components/define/input';
  import type {} from '@oddkin/components/define/side-nav';
</script>

<odd-side-nav items={1}></odd-side-nav>
<odd-side-nav onodd-action={(event) => event.detail.expanded}></odd-side-nav>
<odd-input type="color"></odd-input>
<odd-prompt-input onodd-prompt-submit={(event) => event.detail.id}></odd-prompt-input>
