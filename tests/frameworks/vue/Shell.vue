<script setup lang="ts">
// Compile-time test of the opt-in Vue typings (vue-tsc, tooling/framework-types; `npm run typecheck`).
// Every @vue-expect-error must be an error; an unused one fails the check.
import type {} from '@oddkin/components/frameworks/vue';
import type {} from '@oddkin/ai/define/prompt-input';
import type {} from '@oddkin/components/define/input';
import type {} from '@oddkin/components/define/side-nav';
import type { NavigationItem } from '@oddkin/components/models';
import { ref, shallowRef } from 'vue';

const items = shallowRef<readonly NavigationItem[]>([]);
const name = ref('Ada');
const onAction = (event: CustomEvent<{ id: string; action: string }>) => void event.detail.action;
</script>

<template>
  <odd-side-nav
    label="Primary"
    :items="items"
    current="overview"
    class="nav"
    @odd-action="onAction"
    @odd-toggle="(event) => event.detail.expanded && event.preventDefault()"
  />
  <odd-input v-model="name" label="Name" name="name" required />
  <odd-prompt-input @odd-prompt-submit="(event) => void event.detail.text.trim()" />

  <!-- @vue-expect-error items is an array of entries, not a number -->
  <odd-side-nav :items="1" />
  <!-- @vue-expect-error the action detail has no expanded -->
  <odd-side-nav @odd-action="(event) => event.detail.expanded" />
  <!-- @vue-expect-error type is one of the declared input types -->
  <odd-input type="color" />
  <!-- @vue-expect-error the odd-prompt-submit detail has no id -->
  <odd-prompt-input @odd-prompt-submit="(event) => event.detail.id" />
</template>
