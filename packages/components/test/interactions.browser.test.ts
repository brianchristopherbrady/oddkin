import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { buttonConformance } from '@oddkin/workbench/conformance/button';
import { runConformance } from '@oddkin/workbench/testing';
import '../src/button/button.define.js';
import '../src/input/input.define.js';
import '../src/side-nav/side-nav.define.js';
import type { OddkinInput } from '../src/input/input.js';
import type { NavigationItem } from '../src/models/navigation.js';
import type { OddkinSideNav } from '../src/side-nav/side-nav.js';
import { derivedTag } from './derived.js';

// Shared interaction fixtures (IMPLEMENTATION_PLAN.md M4, multi-product prototype): each runs
// unchanged against the foundation element and a derived implementation of it.

// The button suite runs 11 cases with real input per tag; allow for three engines under load.
vi.setConfig({ testTimeout: 60_000 });

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const settle = async (el: { updateComplete: Promise<void> }) => {
  await el.updateComplete;
  flush();
  await el.updateComplete;
};
async function mount<T extends HTMLElement & { updateComplete: Promise<void> }>(
  tag: string,
  markup: string,
): Promise<T> {
  container.innerHTML = markup.replaceAll('{{tag}}', tag);
  const el = container.querySelector(tag) as T;
  await settle(el);
  return el;
}
const tags = (tag: string) => [tag, derivedTag(tag)];

describe.each(tags('odd-button'))('<%s>', (tag) => {
  it('passes every case of the oddkin.button conformance suite', async () => {
    const result = await runConformance(buttonConformance, {
      tag,
      expect,
      user: userEvent,
      configuration: { theme: 'none' },
    });
    const failed = result.results.filter((r) => r.state !== 'passed');
    expect(failed, JSON.stringify(failed)).toEqual([]);
    expect(result.results).toHaveLength(buttonConformance.cases.length);
  });
});

describe.each(tags('odd-input'))('<%s>', (tag) => {
  it('delegates focus, keeps the label, and dispatches input and change only for typing', async () => {
    const el = await mount<OddkinInput>(tag, '<{{tag}} label="Name" value="Ada"></{{tag}}>');
    const control = el.shadowRoot!.querySelector('input')!;
    expect(control.labels?.[0]?.textContent).toBe('Name');
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input:${el.value}`));
    el.addEventListener('change', () => events.push('change'));
    el.focus();
    expect(el.shadowRoot!.activeElement).toBe(control);
    control.setSelectionRange(3, 3);
    await userEvent.keyboard('x');
    await settle(el);
    expect(el.value).toBe('Adax');
    control.blur();
    el.value = 'set';
    await settle(el);
    expect(events).toEqual(['input:Adax', 'change']);
  });

  it('validates, submits, resets, and is excluded by a disabled fieldset', async () => {
    const el = await mount<OddkinInput>(
      tag,
      '<form><fieldset><{{tag}} label="Email" name="email" type="email" required value="x"></{{tag}}></fieldset></form>',
    );
    const form = container.querySelector('form')!;
    const control = el.shadowRoot!.querySelector('input')!;
    expect(el.form).toBe(form);
    expect(el.validity.typeMismatch).toBe(true);
    el.value = '';
    await settle(el);
    expect([el.validity.valueMissing, form.checkValidity()]).toEqual([true, false]);
    el.value = 'ada@example.com';
    await settle(el);
    expect(el.checkValidity()).toBe(true);
    expect([...new FormData(form)]).toEqual([['email', 'ada@example.com']]);
    const fieldset = container.querySelector('fieldset')!;
    fieldset.disabled = true;
    await settle(el);
    expect(control.disabled).toBe(true);
    expect([...new FormData(form)]).toEqual([]);
    fieldset.disabled = false;
    form.reset();
    await settle(el);
    expect(el.value).toBe('x');
  });
});

const ITEMS: readonly NavigationItem[] = [
  { id: 'overview', kind: 'link', label: 'Overview', href: '/overview' },
  {
    id: 'guides',
    kind: 'group',
    label: 'Guides',
    items: [{ id: 'theming', kind: 'link', label: 'Theming', href: '/guides/theming' }],
  },
  { id: 'off', kind: 'link', label: 'Off', href: '/off', disabled: true },
  { id: 'create', kind: 'action', label: 'Create', action: 'project.create' },
  { id: 'delete', kind: 'action', label: 'Delete', action: 'project.delete', disabled: true },
];

describe.each(tags('odd-side-nav'))('<%s>', (tag) => {
  const nav = async () => {
    const el = await mount<OddkinSideNav>(tag, '<{{tag}} label="Primary"></{{tag}}>');
    el.items = ITEMS;
    el.current = 'overview';
    await settle(el);
    const $ = (selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)!;
    return { el, $ };
  };

  it('toggles a group with Enter and Space, keeping focus on the toggle', async () => {
    const { el, $ } = await nav();
    const toggle = $('[part="group-toggle"]');
    const events: unknown[] = [];
    el.addEventListener('odd-toggle', (e) => events.push((e as CustomEvent).detail));
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await userEvent.keyboard(' ');
    await settle(el);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(events).toEqual([
      { id: 'guides', expanded: true },
      { id: 'guides', expanded: false },
    ]);
    expect(el.shadowRoot!.activeElement).toBe(toggle);
  });

  it('activates enabled actions from the keyboard; disabled entries take no focus or action', async () => {
    const { el, $ } = await nav();
    const seen: unknown[] = [];
    container.addEventListener('odd-action', (e) => seen.push((e as CustomEvent).detail));
    const [create, remove] = [
      ...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="action"]'),
    ];
    create!.focus();
    await userEvent.keyboard('{Enter}');
    remove!.focus();
    remove!.click();
    const off = $('a[aria-disabled="true"]');
    off.focus();
    expect(seen).toEqual([{ id: 'create', action: 'project.create' }]);
    expect(el.shadowRoot!.activeElement).toBe(create);
    expect($('a[aria-current="page"]').textContent).toBe('Overview');
  });
});
