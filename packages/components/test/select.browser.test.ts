import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinSelect } from '../src/select/select.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-select (component-contracts.md §3.3, §2.4, §2.5), with the shipped theme.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
afterEach(async () => {
  await userEvent.unhover(document.body);
  container?.remove();
  flush();
});

const ROLES =
  '<option value="viewer">Viewer</option><option value="editor" selected>Editor</option><option value="admin">Administrator</option><option value="owner" disabled>Owner</option>';

async function mount(attributes = 'label="Workspace role" name="role"', children = ROLES) {
  container = document.createElement('div');
  container.innerHTML = `<form id="form"><odd-select style="inline-size: 320px" ${attributes}>${children}</odd-select><button type="button" id="after">after</button></form>`;
  document.body.append(container);
  const el = container.querySelector<OddkinSelect>('odd-select')!;
  await settle(el);
  const log: string[] = [];
  el.addEventListener('input', () => log.push(`input ${el.value}`));
  el.addEventListener('change', () => log.push(`change ${el.value}`));
  return { el, log, form: container.querySelector('form')! };
}
const control = (el: Element) => el.shadowRoot!.querySelector('select')!;
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const labels = (el: Element) => [...control(el).options].map((option) => option.label);
const choose = async (el: OddkinSelect, value: string) => {
  await userEvent.selectOptions(control(el), value);
  await settle(el);
};
// The control's border and background change with a short transition.
const transitioned = (el: Element) =>
  Promise.all(el.getAnimations().map((animation) => animation.finished));
const inset = () => parseFloat(themeValue('margin-left', '--odd-control-padding-inline-md'));

// The customizable select: Chromium and WebKit here; Firefox draws its own picker.
const enhanced = CSS.supports('(appearance: base-select) and selector(::picker(select))');
// WebKit draws a `base-select` select in a shadow root styled but reports unstyled computed
// values for it and its options; read the closed control there with the engine's look off.
const closed = <T>(select: HTMLSelectElement, read: (style: CSSStyleDeclaration) => T): T => {
  if (server.browser === 'webkit') select.style.appearance = 'none';
  try {
    return read(getComputedStyle(select));
  } finally {
    select.style.removeProperty('appearance');
  }
};

describe('odd-select', () => {
  it('is a labelled native select of its option children, with the declared choice', async () => {
    const { el } = await mount(
      'label="Workspace role" name="role" description="Who can change things"',
    );
    await expect
      .element(page.getByRole('combobox', { name: 'Workspace role', exact: true }))
      .toBeVisible();
    const select = control(el);
    expect(labels(el)).toEqual(['Viewer', 'Editor', 'Administrator', 'Owner']);
    expect(el.value).toBe('editor');
    expect(select.value).toBe('editor');
    expect(select.options[3]!.disabled).toBe(true);
    expect(select.getAttribute('aria-describedby')).toBe('description');
    expect(part(el, 'description').textContent!.trim()).toBe('Who can change things');
    expect(select.required).toBe(false);
    expect(select.hasAttribute('aria-invalid')).toBe(false);
    expect(el.shadowRoot!.querySelector('.control-end')!.getAttribute('aria-hidden')).toBe('true');
    // Focusing the element focuses its select.
    el.focus();
    expect(el.shadowRoot!.activeElement).toBe(select);
    // Children edited later are followed.
    el.querySelector('option')!.textContent = 'Reader';
    await expect.poll(() => labels(el)[0]).toBe('Reader');
    expect(select.value).toBe('editor');
  });

  it('puts grouped options in optgroups, with each description as the option title', async () => {
    const { el } = await mount(
      'label="Region"',
      '<optgroup label="Europe"><option value="fra" title="Germany">Frankfurt</option><option value="dub">Dublin</option></optgroup><option value="any">Any region</option>',
    );
    const group = control(el).querySelector('optgroup')!;
    expect(group.label).toBe('Europe');
    expect([...group.querySelectorAll('option')].map((option) => option.label)).toEqual([
      'Frankfurt',
      'Dublin',
    ]);
    expect(control(el).options[0]!.title).toBe('Germany');
    expect(control(el).lastElementChild!.textContent!.trim()).toBe('Any region');
    expect(el.value).toBe('fra');
  });

  it('reports the user’s choice once through input and change', async () => {
    const { el, log } = await mount();
    await choose(el, 'admin');
    expect(el.value).toBe('admin');
    expect(control(el).value).toBe('admin');
    expect(log).toEqual(['input admin', 'change admin']);
  });

  it('shows a placeholder until a choice, and blocks submission while required', async () => {
    const { el, form } = await mount(
      'label="Workspace role" name="role" placeholder="Choose a role…" required',
      ROLES.replace(' selected', ''),
    );
    const select = control(el);
    const placeholder = select.options[0]!;
    expect([placeholder.label, placeholder.value, placeholder.disabled]).toEqual([
      'Choose a role…',
      '',
      true,
    ]);
    expect(el.value).toBe('');
    expect(select.value).toBe('');
    expect(select.required).toBe(true);
    expect(new FormData(form).get('role')).toBe('');
    expect(el.validity.valueMissing).toBe(true);
    expect(el.validationMessage).not.toBe('');
    // A blocked submission points at the select and shows the error state.
    expect(form.reportValidity()).toBe(false);
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(select);
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(el.matches(':state(user-invalid)')).toBe(true);
    // (A script chooses next: WebKit's validation bubble takes the next key press or click.)
    el.value = 'editor';
    await settle(el);
    expect(select.value).toBe('editor');
    expect(el.checkValidity()).toBe(true);
    expect(new FormData(form).get('role')).toBe('editor');
    form.reset();
    await settle(el);
    expect(el.value).toBe('');
    expect(select.value).toBe('');
  });

  it('shows the error state once the user leaves a required select on its placeholder', async () => {
    const { el } = await mount(
      'label="Workspace role" placeholder="Choose a role…" required',
      ROLES.replace(' selected', ''),
    );
    control(el).focus();
    await settle(el);
    expect(control(el).hasAttribute('aria-invalid')).toBe(false);
    (container.querySelector('#after') as HTMLElement).focus();
    await settle(el);
    expect(control(el).getAttribute('aria-invalid')).toBe('true');
  });

  it('starts on the last selected option, else the first usable one, as a native select', async () => {
    const { el, form } = await mount(
      'label="Letter" name="letter"',
      '<option value="a" disabled>A</option><option value="b">B</option><option value="c">C</option>',
    );
    expect(el.value).toBe('b');
    expect(control(el).value).toBe('b');
    expect(new FormData(form).get('letter')).toBe('b');
    // The default follows the options until someone chooses.
    el.querySelector('option[value="b"]')!.remove();
    await expect.poll(() => el.value).toBe('c');
    el.innerHTML = '<option value="a" selected>A</option><option value="b" selected>B</option>';
    await expect.poll(() => el.value).toBe('b');
  });

  it('takes the value attribute as the default over a selected option, also on reset, and restores', async () => {
    const { el, form } = await mount('label="Workspace role" name="role" value="admin"');
    expect(el.value).toBe('admin');
    expect(control(el).value).toBe('admin');
    await choose(el, 'viewer');
    form.reset();
    await settle(el);
    expect(el.value).toBe('admin');
    expect(control(el).value).toBe('admin');
    el.formStateRestoreCallback('viewer', 'restore');
    el.formStateRestoreCallback(null, 'restore');
    await settle(el);
    expect(el.value).toBe('viewer');
    expect(control(el).value).toBe('viewer');
  });

  it('keeps a value set by a script over the declared default', async () => {
    container = document.createElement('div');
    const el = document.createElement('odd-select') as OddkinSelect;
    el.innerHTML = ROLES;
    el.value = 'admin';
    container.append(el);
    document.body.append(container);
    await settle(el);
    expect(el.value).toBe('admin');
    expect(control(el).value).toBe('admin');
    el.value = 'viewer';
    await settle(el);
    el.querySelector('option[value="editor"]')!.removeAttribute('selected');
    el.querySelector('option[value="admin"]')!.setAttribute('selected', '');
    await new Promise((resolve) => setTimeout(resolve, 50));
    await settle(el);
    expect(el.value).toBe('viewer');
    expect(control(el).value).toBe('viewer');
  });

  it('keeps a script’s value when the declared default changes later', async () => {
    const { el } = await mount();
    el.value = 'viewer';
    await settle(el);
    el.querySelector('option[value="editor"]')!.removeAttribute('selected');
    el.querySelector('option[value="admin"]')!.setAttribute('selected', '');
    await new Promise((resolve) => setTimeout(resolve, 50));
    await settle(el);
    expect(el.value).toBe('viewer');
    expect(control(el).value).toBe('viewer');
  });

  it('follows the declared default until someone chooses', async () => {
    const { el } = await mount();
    el.querySelector('option[value="editor"]')!.removeAttribute('selected');
    el.querySelector('option[value="admin"]')!.setAttribute('selected', '');
    await expect.poll(() => el.value).toBe('admin');
    await choose(el, 'viewer');
    el.querySelector('option[value="admin"]')!.removeAttribute('selected');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(el.value).toBe('viewer');
  });

  it('is disabled and not submitted when disabled, also by a disabled fieldset', async () => {
    const { el, form } = await mount('label="Workspace role" name="role" disabled');
    expect(control(el).disabled).toBe(true);
    expect(new FormData(form).has('role')).toBe(false);
    el.disabled = false;
    await settle(el);
    expect(control(el).disabled).toBe(false);
    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    form.append(fieldset);
    fieldset.append(el);
    await settle(el);
    expect(control(el).disabled).toBe(true);
  });

  it('takes options from the property, which wins over children', async () => {
    const warnings: unknown[] = [];
    const warn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args[0]);
    try {
      const { el } = await mount('label="Role"');
      el.options = [
        { value: 'v', label: 'Viewer', description: 'Can view', group: 'Read' },
        { value: 'e', label: 'Editor', disabled: true },
      ];
      await settle(el);
      expect(labels(el)).toEqual(['Viewer', 'Editor']);
      expect(control(el).querySelector('optgroup')!.label).toBe('Read');
      expect(control(el).options[0]!.title).toBe('Can view');
      expect(control(el).options[1]!.disabled).toBe(true);
      expect(String(warnings[0])).toContain('[collection.source.conflict]');
      // The declared default follows the new options until someone chooses.
      expect(el.value).toBe('v');
    } finally {
      console.warn = warn;
    }
  });

  it('draws the field: the chevron, the placeholder in secondary text, and the error and disabled states', async () => {
    const { el } = await mount(
      'label="Workspace role" placeholder="Choose a role…"',
      ROLES.replace(' selected', ''),
    );
    const select = control(el);
    expect(closed(select, (style) => style.color)).toBe(
      themeValue('color', '--odd-color-text-secondary'),
    );
    // The options keep primary text, also in the engine's own picker.
    if (server.browser !== 'webkit')
      expect(getComputedStyle(select.options[1]!).color).toBe(
        themeValue('color', '--odd-color-text-primary'),
      );
    // The chevron sits at the inline end, in the padding the select keeps free for it.
    const chevron = el.shadowRoot!.querySelector<HTMLElement>('.control-end')!;
    const box = select.getBoundingClientRect();
    expect(box.right - chevron.getBoundingClientRect().right).toBeCloseTo(inset(), 0);
    expect(closed(select, (style) => parseFloat(style.paddingInlineEnd))).toBeGreaterThan(
      chevron.getBoundingClientRect().width + inset(),
    );
    await choose(el, 'viewer');
    expect(closed(select, (style) => style.color)).toBe(
      themeValue('color', '--odd-color-text-primary'),
    );
    el.error = 'Choose a role to continue.';
    await settle(el);
    await transitioned(select);
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toContain('error');
    expect(closed(select, (style) => style.borderTopColor)).toBe(
      themeValue('border-top-color', '--odd-color-danger-foreground'),
    );
    el.disabled = true;
    await settle(el);
    await transitioned(select);
    expect(closed(select, (style) => style.backgroundColor)).toBe(
      themeValue('background-color', '--odd-color-surface-sunken'),
    );
    expect(getComputedStyle(chevron).color).toBe(themeValue('color', '--odd-color-text-disabled'));
    expect(getComputedStyle(part(el, 'label')).color).toBe(
      themeValue('color', '--odd-color-text-disabled'),
    );
  });

  it.runIf(enhanced)(
    'draws the open picker as the raised listbox surface with square option rows (appearance: base-select)',
    async () => {
      const { el, log } = await mount('label="Workspace role" placeholder="Choose a role…"');
      const select = control(el);
      expect(getComputedStyle(select).appearance).toBe('base-select');
      await userEvent.click(select);
      await expect.poll(() => select.matches(':open')).toBe(true);
      const [placeholder, viewer, editor, , owner] = [...select.options];
      // The placeholder stays out of the picker, which hangs below the select.
      expect(placeholder!.getBoundingClientRect().height).toBe(0);
      expect(viewer!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        select.getBoundingClientRect().bottom,
      );
      // Rows of the option-row box: the control height, the label inset by the inline padding.
      for (const row of [viewer, editor, owner])
        expect(`${row!.getBoundingClientRect().height}px`).toBe(
          themeValue('block-size', '--odd-control-height-md'),
        );
      const text = document.createRange();
      text.selectNodeContents(viewer!);
      expect(text.getBoundingClientRect().left - viewer!.getBoundingClientRect().left).toBeCloseTo(
        inset(),
        0,
      );
      if (server.browser !== 'webkit') {
        const picker = getComputedStyle(select, '::picker(select)');
        expect(picker.backgroundColor).toBe(
          themeValue('background-color', '--odd-color-surface-raised'),
        );
        expect(picker.borderTopColor).toBe(
          themeValue('border-top-color', '--odd-color-border-default'),
        );
        expect(picker.borderTopLeftRadius).toBe(
          themeValue('border-top-left-radius', '--odd-control-radius'),
        );
        expect(picker.boxShadow).not.toBe('none');
        const chosen = getComputedStyle(editor!);
        expect(chosen.borderTopLeftRadius).toBe('0px');
        expect(chosen.borderTopWidth).toBe(themeValue('margin-top', '--odd-border-width-default'));
        expect(getComputedStyle(viewer!).borderTopWidth).toBe('0px');
        expect(chosen.backgroundColor).toBe(
          themeValue('background-color', '--odd-color-selection-surface'),
        );
        expect(getComputedStyle(owner!).color).toBe(
          themeValue('color', '--odd-color-text-disabled'),
        );
        expect(getComputedStyle(editor!, '::checkmark').order).toBe('1');
        await userEvent.hover(viewer!);
        expect(getComputedStyle(viewer!).backgroundColor).toBe(
          themeValue('background-color', '--odd-color-surface-hover'),
        );
        // The picker's surface is the theme's raised surface.
        el.style.setProperty('--odd-color-surface-raised', 'rgb(1, 2, 3)');
        expect(getComputedStyle(select, '::picker(select)').backgroundColor).toBe('rgb(1, 2, 3)');
        el.style.removeProperty('--odd-color-surface-raised');
      }
      // Choosing a row closes the picker and reports the choice.
      await userEvent.click(viewer!);
      await settle(el);
      expect(el.value).toBe('viewer');
      expect(log).toEqual(['input viewer', 'change viewer']);
      expect(select.matches(':open')).toBe(false);
      // Opened from the keyboard, the focused row shows the inset ring of the option rows.
      await userEvent.keyboard(' ');
      await expect.poll(() => select.matches(':open')).toBe(true);
      await expect.poll(() => viewer!.matches(':focus-visible')).toBe(true);
      if (server.browser !== 'webkit') {
        const ring = getComputedStyle(viewer!);
        expect(ring.outlineColor).toBe(themeValue('outline-color', '--odd-color-focus-ring'));
        expect(ring.outlineOffset).toBe(`-${ring.outlineWidth}`);
      }
      await userEvent.keyboard('{Escape}');
    },
  );

  it.runIf(!enhanced)(
    'leaves the open picker to the engine where appearance: base-select is not supported',
    async () => {
      const { el } = await mount('label="Workspace role" placeholder="Choose a role…"');
      const select = control(el);
      // The chevron replaces the engine's arrow; the rows, and the disabled placeholder among
      // them, are the engine's.
      expect(getComputedStyle(select).appearance).toBe('none');
      expect(getComputedStyle(select.options[0]!).display).not.toBe('none');
      expect(getComputedStyle(select.options[1]!).paddingInlineStart).not.toBe(
        themeValue('padding-left', '--odd-control-padding-inline-md'),
      );
      await choose(el, 'viewer');
      expect(el.value).toBe('viewer');
    },
  );

  it.runIf(server.browser === 'chromium' && enhanced)(
    'marks the chosen and disabled options in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el } = await mount();
        const [, editor, , owner] = [...control(el).options];
        const probe = document.createElement('span');
        container.append(probe);
        probe.style.color = 'Highlight';
        expect(getComputedStyle(editor!).backgroundColor).toBe(getComputedStyle(probe).color);
        probe.style.color = 'HighlightText';
        expect(getComputedStyle(editor!).color).toBe(getComputedStyle(probe).color);
        probe.style.color = 'GrayText';
        expect(getComputedStyle(owner!).color).toBe(getComputedStyle(probe).color);
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything when removed', async () => {
    const before = scopeStats();
    const { el } = await mount();
    await choose(el, 'admin');
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
