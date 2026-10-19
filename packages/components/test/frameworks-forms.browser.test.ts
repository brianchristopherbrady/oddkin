import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@angular/compiler';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  provideZonelessChangeDetection,
  type ApplicationRef,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { bootstrapApplication } from '@angular/platform-browser';
import { createElement, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { flushSync as flushSvelte, mount, unmount } from 'svelte';
import { createApp, h, nextTick, ref, vModelText, withDirectives } from 'vue';
import { flush } from '@oddkin/core/reactive';
import type { OddkinInput } from '../src/input/input.js';
import '../src/input/input.define.js';
import NameField from './fixtures/NameField.svelte';
import { NAME, checkNameField, nameField } from './framework-fixtures.js';

// odd-input bound with each framework's own form binding, with no adapter code: the value goes in
// as a property and user input comes back through the composed native `input` event.

let container: HTMLElement;
const cleanup: (() => void)[] = [];
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  container.remove();
  flush();
});

describe('odd-input with framework form bindings', () => {
  it('React 19: value prop and onInput', async () => {
    let name = NAME;
    let setName!: (value: string) => void;
    function App() {
      const [value, set] = useState(NAME);
      name = value;
      setName = set;
      return createElement(
        'form',
        null,
        createElement('odd-input', {
          label: 'Name',
          name: 'name',
          required: true,
          value,
          onInput: (e: { currentTarget: EventTarget }) =>
            set((e.currentTarget as OddkinInput).value),
        }),
      );
    }
    const root = createRoot(container);
    cleanup.push(() => root.unmount());
    flushSync(() => root.render(createElement(App)));
    await checkNameField(container, {
      read: () => name,
      write: async (value) => flushSync(() => setName(value)),
    });
  });

  it('Vue 3: v-model (vModelText, as compiled for a custom element)', async () => {
    const name = ref(NAME);
    const app = createApp({
      setup: () => () =>
        h('form', [
          withDirectives(
            h('odd-input', {
              label: 'Name',
              name: 'name',
              required: true,
              'onUpdate:modelValue': (value: string) => (name.value = value),
            }),
            [[vModelText, name.value]],
          ),
        ]),
    });
    app.mount(container);
    cleanup.push(() => app.unmount());
    await checkNameField(container, {
      read: () => name.value,
      write: async (value) => {
        name.value = value;
        await nextTick();
      },
    });
  });

  it('Angular 22: Reactive Forms through the built-in DefaultValueAccessor (ngDefaultControl)', async () => {
    const NameForm = Component({
      selector: 'app-name-form',
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [ReactiveFormsModule],
      template: `<form>
        <odd-input label="Name" name="name" required ngDefaultControl [formControl]="name"></odd-input>
      </form>`,
    })(
      class {
        readonly name = new FormControl(NAME, {
          nonNullable: true,
          validators: [Validators.required],
        });
      },
    );
    container.innerHTML = '<app-name-form></app-name-form>';
    const app: ApplicationRef = await bootstrapApplication(NameForm, {
      providers: [provideZonelessChangeDetection()],
    });
    cleanup.push(() => app.destroy());
    const control = (app.components[0]!.instance as { name: FormControl<string> }).name;
    await checkNameField(container, {
      read: () => control.value,
      write: async (value) => {
        control.setValue(value);
        await app.whenStable();
      },
    });
    expect(control.valid).toBe(true);

    // The accessor's other half: blur marks the control touched, disable() disables the element.
    const el = await nameField(container);
    expect(control.touched).toBe(false);
    el.shadowRoot!.querySelector('input')!.blur();
    expect(control.touched).toBe(true);
    control.disable();
    await app.whenStable();
    await nameField(container);
    expect([el.disabled, [...new FormData(container.querySelector('form')!)]]).toEqual([true, []]);
    control.enable();
    await app.whenStable();
    await nameField(container);
    expect(el.disabled).toBe(false);
  });

  it('Svelte 5: value property and oninput (bind:value is native-only)', async () => {
    const app = mount(NameField, { target: container, props: { initial: NAME } });
    cleanup.push(() => void unmount(app));
    flushSvelte();
    const field = app as unknown as { read(): string; write(value: string): void };
    await checkNameField(container, {
      read: () => field.read(),
      write: async (value) => {
        field.write(value);
        flushSvelte();
      },
    });
  });
});
