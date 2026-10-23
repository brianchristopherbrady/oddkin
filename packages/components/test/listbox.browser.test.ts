import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinListbox } from '../src/listbox/listbox.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-listbox (component-contracts.md §3.3, §2.4, §2.5), with the shipped theme.
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
  container.innerHTML = `<form id="form"><button type="button" id="before">before</button><odd-listbox style="inline-size: 320px" ${attributes}>${children}</odd-listbox><button type="button" id="after">after</button></form>`;
  document.body.append(container);
  const el = container.querySelector<OddkinListbox>('odd-listbox')!;
  await settle(el);
  const log: string[] = [];
  const now = () => (el.multiple ? String(el.values) : el.value);
  el.addEventListener('input', () => log.push(`input ${now()}`));
  el.addEventListener('change', () => log.push(`change ${now()}`));
  return { el, log, form: container.querySelector('form')! };
}
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const options = (el: Element) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]'),
];
const text = (row: Element | null | undefined) => row?.querySelector('.option-text')?.textContent;
const option = (el: Element, label: string) => options(el).find((row) => text(row) === label)!;
const selected = (el: Element) =>
  options(el)
    .filter((row) => row.getAttribute('aria-selected') === 'true')
    .map(text);
/** The label of the active option. */
const active = (el: Element) => {
  const id = part(el, 'listbox').getAttribute('aria-activedescendant');
  return id ? text(el.shadowRoot!.getElementById(id)) : undefined;
};
const press = async (el: OddkinListbox, keys: string) => {
  part(el, 'listbox').focus();
  await userEvent.keyboard(keys);
  await settle(el);
};

describe('odd-listbox', () => {
  it('is a labelled listbox of its option children, with the declared selection', async () => {
    const { el } = await mount(
      'label="Workspace role" name="role" description="Who can change things"',
    );
    await expect
      .element(page.getByRole('listbox', { name: 'Workspace role', exact: true }))
      .toBeVisible();
    expect(options(el).map(text)).toEqual(['Viewer', 'Editor', 'Administrator', 'Owner']);
    expect(selected(el)).toEqual(['Editor']);
    expect(options(el).map((row) => row.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(el.value).toBe('editor');
    expect(option(el, 'Owner').getAttribute('aria-disabled')).toBe('true');
    const listbox = part(el, 'listbox');
    expect(listbox.getAttribute('aria-describedby')).toBe('description');
    expect(listbox.tabIndex).toBe(0);
    for (const name of ['aria-multiselectable', 'aria-required', 'aria-invalid', 'aria-busy'])
      expect(listbox.hasAttribute(name)).toBe(false);
    expect(part(el, 'empty').hidden).toBe(true);
    expect(part(el, 'loading').hidden).toBe(true);
    // Children edited later are followed.
    el.querySelector('option')!.textContent = 'Reader';
    await expect.poll(() => options(el).map(text)[0]).toBe('Reader');
  });

  it('groups options under their optgroup label', async () => {
    const { el } = await mount(
      'label="Region"',
      '<optgroup label="Europe"><option value="fra">Frankfurt</option><option value="dub">Dublin</option></optgroup><option value="any">Any region</option>',
    );
    const group = el.shadowRoot!.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-labelledby')).toBe(part(el, 'group').id);
    expect(part(el, 'group').textContent!.trim()).toBe('Europe');
    expect([...group.querySelectorAll('[role="option"]')].map(text)).toEqual([
      'Frankfurt',
      'Dublin',
    ]);
    expect(option(el, 'Any region').closest('[role="group"]')).toBeNull();
  });

  it('starts at the selected option, and selection follows the arrows, Home, End, and typing', async () => {
    const { el, log } = await mount();
    part(el, 'listbox').focus();
    await settle(el);
    expect(active(el)).toBe('Editor');
    expect(option(el, 'Editor').classList.contains('active')).toBe(true);
    await userEvent.keyboard('{ArrowDown}');
    await settle(el);
    expect(el.value).toBe('admin');
    expect(active(el)).toBe('Administrator');
    // The disabled last option is skipped, and the ends do not wrap.
    await userEvent.keyboard('{ArrowDown}');
    await settle(el);
    expect(el.value).toBe('admin');
    await userEvent.keyboard('{Home}');
    await settle(el);
    expect(el.value).toBe('viewer');
    await userEvent.keyboard('e');
    await settle(el);
    expect(el.value).toBe('editor');
    await userEvent.keyboard('{End}');
    await settle(el);
    expect(el.value).toBe('admin');
    expect(log).toEqual([
      'input admin',
      'change admin',
      'input viewer',
      'change viewer',
      'input editor',
      'change editor',
      'input admin',
      'change admin',
    ]);
    // Leaving hides the active option; the selection stays.
    (container.querySelector('#after') as HTMLElement).focus();
    await settle(el);
    expect(option(el, 'Administrator').classList.contains('active')).toBe(false);
  });

  it('selects with a click, and ignores disabled options', async () => {
    const { el, log } = await mount();
    await userEvent.click(option(el, 'Viewer'));
    await settle(el);
    expect(el.value).toBe('viewer');
    expect(active(el)).toBe('Viewer');
    await userEvent.click(option(el, 'Owner'), { force: true });
    await settle(el);
    expect(el.value).toBe('viewer');
    expect(getComputedStyle(option(el, 'Owner')).cursor).toBe('not-allowed');
    expect(log).toEqual(['input viewer', 'change viewer']);
  });

  it('toggles with Space, Enter, and a click, extends with Shift, and selects all with Ctrl+A when multiple', async () => {
    const { el, log } = await mount('label="Notify me about" name="topics" multiple');
    expect(el.values).toEqual(['editor']);
    expect(part(el, 'listbox').getAttribute('aria-multiselectable')).toBe('true');
    // Moving does not select.
    await press(el, '{ArrowUp}');
    expect(el.values).toEqual(['editor']);
    await userEvent.keyboard(' ');
    await settle(el);
    expect(el.values).toEqual(['editor', 'viewer']);
    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}');
    await settle(el);
    expect(el.values).toEqual(['editor', 'viewer', 'admin']);
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(el.values).toEqual(['editor', 'viewer']);
    await userEvent.click(option(el, 'Editor'));
    await settle(el);
    expect(el.values).toEqual(['viewer']);
    await userEvent.keyboard('{Control>}a{/Control}');
    await settle(el);
    expect([...el.values!].sort()).toEqual(['admin', 'editor', 'viewer']);
    expect(selected(el)).toEqual(['Viewer', 'Editor', 'Administrator']);
    expect(log).toEqual([
      'input editor,viewer',
      'change editor,viewer',
      'input editor,viewer,admin',
      'change editor,viewer,admin',
      'input editor,viewer',
      'change editor,viewer',
      'input viewer',
      'change viewer',
      'input viewer,editor,admin',
      'change viewer,editor,admin',
    ]);
  });

  it('extends from the last toggled option over usable options with a Shift click', async () => {
    const { el, log } = await mount(
      'label="Letters" multiple',
      '<option value="a">A</option><option value="b">B</option><option value="c" disabled>C</option><option value="d">D</option><option value="e">E</option>',
    );
    await press(el, '{ArrowDown} ');
    expect(el.values).toEqual(['b']);
    await userEvent.click(option(el, 'E'), { modifiers: ['Shift'] });
    await settle(el);
    expect(el.values).toEqual(['b', 'd', 'e']);
    expect(log).toEqual(['input b', 'change b', 'input b,d,e', 'change b,d,e']);
  });

  it('continues a typeahead query with Space instead of selecting', async () => {
    const { el } = await mount(
      'label="Role" multiple',
      '<option value="a">Read only</option><option value="b">Read and write</option>',
    );
    await press(el, 'Read a');
    expect(active(el)).toBe('Read and write');
    expect(el.values).toEqual([]);
  });

  it('submits, requires, resets, and restores like a native select', async () => {
    const { el, form } = await mount(
      'label="Workspace role" name="role" required',
      ROLES.replace(' selected', ''),
    );
    expect(new FormData(form).get('role')).toBeNull();
    expect(el.validity.valueMissing).toBe(true);
    expect(el.validationMessage).not.toBe('');
    expect(part(el, 'listbox').getAttribute('aria-required')).toBe('true');
    // A blocked submission points at the listbox and shows the error state.
    expect(form.reportValidity()).toBe(false);
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(part(el, 'listbox'));
    expect(part(el, 'listbox').getAttribute('aria-invalid')).toBe('true');
    // With nothing selected, focus shows the first option without selecting it. (A script sets
    // the value next: WebKit's validation bubble takes the next key press or click.)
    expect(active(el)).toBe('Viewer');
    expect(el.value).toBe('');
    el.value = 'editor';
    await settle(el);
    expect(new FormData(form).get('role')).toBe('editor');
    expect(el.checkValidity()).toBe(true);
    form.reset();
    await settle(el);
    expect(el.value).toBe('');
  });

  it('shows the error state once the user leaves a required, empty listbox', async () => {
    const { el } = await mount('label="Workspace role" required', ROLES.replace(' selected', ''));
    part(el, 'listbox').focus();
    await settle(el);
    expect(part(el, 'listbox').hasAttribute('aria-invalid')).toBe(false);
    (container.querySelector('#after') as HTMLElement).focus();
    await settle(el);
    expect(part(el, 'listbox').getAttribute('aria-invalid')).toBe('true');
    expect(el.matches(':state(user-invalid)')).toBe(true);
  });

  it('takes the value attribute as the default over a selected option, also on reset', async () => {
    const { el, form } = await mount('label="Workspace role" name="role" value="admin"');
    expect(el.value).toBe('admin');
    await press(el, '{Home}');
    expect(el.value).toBe('viewer');
    form.reset();
    await settle(el);
    expect(el.value).toBe('admin');
  });

  it('submits each selected value and resets to the declared selection when multiple', async () => {
    const { el, form } = await mount('label="Topics" name="topics" multiple');
    await press(el, '{Home} ');
    expect(new FormData(form).getAll('topics')).toEqual(['editor', 'viewer']);
    form.reset();
    await settle(el);
    expect(el.values).toEqual(['editor']);
  });

  it('keeps a selection set as a property over the declared default', async () => {
    container = document.createElement('div');
    const el = document.createElement('odd-listbox') as OddkinListbox;
    el.innerHTML = ROLES;
    el.value = 'admin';
    container.append(el);
    document.body.append(container);
    await settle(el);
    expect(el.value).toBe('admin');
    el.value = 'viewer';
    el.querySelector('option')!.setAttribute('label', 'Reader');
    await settle(el);
    await expect.poll(() => text(options(el)[0])).toBe('Reader');
    expect(el.value).toBe('viewer');
  });

  it('keeps a script’s selection when the declared default changes later', async () => {
    const { el } = await mount();
    expect(el.value).toBe('editor');
    el.value = 'viewer';
    await settle(el);
    el.querySelector('option[value="editor"]')!.removeAttribute('selected');
    el.querySelector('option[value="admin"]')!.setAttribute('selected', '');
    await new Promise((resolve) => setTimeout(resolve, 50));
    await settle(el);
    expect(el.value).toBe('viewer');
    expect(selected(el)).toEqual(['Viewer']);
  });

  it('follows the declared default until someone chooses', async () => {
    const { el } = await mount();
    el.querySelector('option[value="editor"]')!.removeAttribute('selected');
    el.querySelector('option[value="admin"]')!.setAttribute('selected', '');
    await expect.poll(() => el.value).toBe('admin');
  });

  it('is skipped and inert when disabled, also by a disabled fieldset', async () => {
    const { el, log } = await mount('label="Workspace role" name="role" disabled');
    expect(part(el, 'listbox').hasAttribute('tabindex')).toBe(false);
    expect(part(el, 'listbox').getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(option(el, 'Viewer'), { force: true });
    expect(el.value).toBe('editor');
    expect(log).toEqual([]);
    expect(getComputedStyle(option(el, 'Viewer')).color).toBe(
      themeValue('color', '--odd-color-text-disabled'),
    );
    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    el.disabled = false;
    container.querySelector('form')!.append(fieldset);
    fieldset.append(el);
    await settle(el);
    expect(part(el, 'listbox').getAttribute('aria-disabled')).toBe('true');
  });

  it('takes options from the property, which wins over children', async () => {
    const warnings: unknown[] = [];
    const warn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args[0]);
    try {
      const { el } = await mount('label="Role"');
      el.options = [
        { value: 'v', label: 'Viewer', description: 'Can view' },
        { value: 'e', label: 'Editor', disabled: true },
      ];
      await settle(el);
      expect(options(el).map(text)).toEqual(['Viewer', 'Editor']);
      expect(options(el)[0]!.querySelector('.option-description')!.textContent).toBe('Can view');
      expect(String(warnings[0])).toContain('[collection.source.conflict]');
    } finally {
      console.warn = warn;
    }
  });

  it('shows the loading, empty, and status states', async () => {
    const { el } = await mount('label="Role" loading', '');
    expect(part(el, 'loading').hidden).toBe(false);
    expect(part(el, 'loading').textContent!.trim()).toBe('Loading…');
    expect(part(el, 'empty').hidden).toBe(true);
    expect(part(el, 'listbox').hidden).toBe(true);
    el.loading = false;
    await settle(el);
    await expect.element(page.getByText('No options available')).toBeVisible();
    el.strings = { empty: 'Nothing to choose' };
    el.insertAdjacentHTML('beforeend', '<p slot="status" role="alert">Unable to load</p>');
    await settle(el);
    await expect.element(page.getByText('Nothing to choose')).toBeVisible();
    await expect.element(page.getByRole('alert')).toHaveTextContent('Unable to load');
    el.innerHTML = ROLES;
    el.loading = true;
    await expect.poll(() => options(el).length).toBe(4);
    expect(part(el, 'listbox').getAttribute('aria-busy')).toBe('true');
    expect(part(el, 'empty').hidden).toBe(true);
  });

  it('draws the raised surface, square rows between dividers, and the selection', async () => {
    const { el } = await mount();
    const surface = getComputedStyle(part(el, 'base'));
    expect(surface.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-raised'),
    );
    expect(surface.borderTopColor).toBe(
      themeValue('border-top-color', '--odd-color-border-default'),
    );
    expect(surface.borderTopLeftRadius).toBe(
      themeValue('border-top-left-radius', '--odd-control-radius'),
    );
    expect(surface.boxShadow).not.toBe('none');
    const second = getComputedStyle(option(el, 'Editor'));
    expect(second.borderTopLeftRadius).toBe('0px');
    expect(second.borderTopWidth).toBe(themeValue('margin-top', '--odd-border-width-default'));
    expect(getComputedStyle(option(el, 'Viewer')).borderTopWidth).toBe('0px');
    expect(second.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-selection-surface'),
    );
    expect(getComputedStyle(option(el, 'Editor').querySelector('.option-check')!).visibility).toBe(
      'visible',
    );
    expect(getComputedStyle(option(el, 'Viewer').querySelector('.option-check')!).visibility).toBe(
      'hidden',
    );
    // Focus shows as the active option's ring, not around the listbox.
    part(el, 'listbox').focus();
    await settle(el);
    expect(getComputedStyle(part(el, 'listbox')).outlineStyle).toBe('none');
    expect(getComputedStyle(option(el, 'Editor')).outlineColor).toBe(
      themeValue('outline-color', '--odd-color-focus-ring'),
    );
    // Many options scroll within the maximum height, keeping the active one in view.
    el.style.setProperty('--odd-listbox-max-height', '6rem');
    await press(el, '{End}');
    const box = part(el, 'listbox').getBoundingClientRect();
    const last = option(el, 'Administrator').getBoundingClientRect();
    expect(last.bottom).toBeLessThanOrEqual(box.bottom + 1);
    expect(part(el, 'listbox').scrollTop).toBeGreaterThan(0);
  });

  it.runIf(server.browser === 'chromium')(
    'marks the selection and disabled options in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el } = await mount();
        const probe = document.createElement('span');
        probe.style.color = 'Highlight';
        container.append(probe);
        expect(getComputedStyle(option(el, 'Editor')).backgroundColor).toBe(
          getComputedStyle(probe).color,
        );
        probe.style.color = 'GrayText';
        expect(getComputedStyle(option(el, 'Owner')).color).toBe(getComputedStyle(probe).color);
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything when removed', async () => {
    const before = scopeStats();
    const { el } = await mount();
    await press(el, 'a');
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
