import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinCombobox } from '../src/combobox/combobox.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-combobox (component-contracts.md §3.3, §2.4, §2.5), with the shipped theme.
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

const PROJECTS =
  '<option value="atlas">Atlas</option><option value="beacon" title="Archived">Beacon</option><option value="cobalt" selected>Cobalt</option><option value="delta" disabled>Delta</option><option value="ember">Ember</option>';

async function mount(attributes = 'label="Project" name="project"', children = PROJECTS) {
  container = document.createElement('div');
  container.innerHTML = `<form id="form"><button type="button" id="before">before</button><odd-combobox style="inline-size: 320px" ${attributes}>${children}</odd-combobox><button type="button" id="after">after</button></form>`;
  document.body.append(container);
  const el = container.querySelector<OddkinCombobox>('odd-combobox')!;
  await settle(el);
  const log: string[] = [];
  const now = () => (el.multiple ? String(el.values) : el.value);
  el.addEventListener('input', () => log.push(`input ${now()}`));
  el.addEventListener('change', () => log.push(`change ${now()}`));
  el.addEventListener('odd-query-change', (event) =>
    log.push(`query ${(event as CustomEvent<{ query: string }>).detail.query}`),
  );
  return { el, log, form: container.querySelector('form')! };
}
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const parts = (el: Element, name: string) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${name}"]`),
];
const input = (el: Element) => part(el, 'input') as HTMLInputElement;
const options = (el: Element) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]'),
];
const text = (row: Element | null | undefined) => row?.querySelector('.option-text')?.textContent;
const shown = (el: Element) => options(el).map(text);
const option = (el: Element, label: string) => options(el).find((row) => text(row) === label)!;
const open = (el: Element) => part(el, 'popup').matches(':popover-open');
/** The label of the active option. */
const active = (el: Element) => {
  const id = input(el).getAttribute('aria-activedescendant');
  return id ? text(el.shadowRoot!.getElementById(id)) : undefined;
};
const press = async (el: OddkinCombobox, keys: string) => {
  if (el.shadowRoot!.activeElement !== input(el)) input(el).focus();
  await userEvent.keyboard(keys);
  await settle(el);
};
const chips = (el: Element) =>
  parts(el, 'chip').map((chip) => chip.querySelector('.chip-text')!.textContent);

describe('odd-combobox', () => {
  it('is a labelled combobox showing the chosen option, with its popup closed', async () => {
    const { el } = await mount('label="Project" name="project" description="Search by name"');
    const box = input(el);
    await expect
      .element(page.getByRole('combobox', { name: 'Project', exact: true }))
      .toBeVisible();
    expect(el.value).toBe('cobalt');
    expect(box.value).toBe('Cobalt');
    expect(box.getAttribute('aria-expanded')).toBe('false');
    expect(box.getAttribute('aria-controls')).toBe('listbox');
    expect(box.getAttribute('aria-autocomplete')).toBe('list');
    expect(box.getAttribute('aria-describedby')).toBe('description');
    expect(part(el, 'listbox').getAttribute('aria-labelledby')).toBe('label');
    expect(open(el)).toBe(false);
    expect(part(el, 'clear').hidden).toBe(false);
    for (const name of ['aria-required', 'aria-invalid', 'aria-activedescendant'])
      expect(box.hasAttribute(name)).toBe(false);
  });

  it('filters while typing, activates the first match, and chooses it with Enter', async () => {
    const { el, log } = await mount();
    await press(el, '{Control>}a{/Control}e');
    expect(open(el)).toBe(true);
    expect(input(el).getAttribute('aria-expanded')).toBe('true');
    expect(shown(el)).toEqual(['Beacon', 'Delta', 'Ember']);
    expect(active(el)).toBe('Beacon');
    expect(option(el, 'Beacon').classList.contains('active')).toBe(true);
    expect(el.query).toBe('e');
    await press(el, 'm');
    expect(shown(el)).toEqual(['Ember']);
    expect(active(el)).toBe('Ember');
    // Typing is not a value change.
    expect(log).toEqual(['query e', 'query em']);
    expect(el.value).toBe('cobalt');
    await press(el, '{Enter}');
    expect(el.value).toBe('ember');
    expect(input(el).value).toBe('Ember');
    expect(open(el)).toBe(false);
    expect(el.query).toBe('');
    expect(log.slice(2)).toEqual(['input ember', 'change ember']);
    expect(el.shadowRoot!.activeElement).toBe(input(el));
    // Opening again shows every option, not only the last matches.
    await press(el, '{ArrowDown}');
    expect(shown(el)).toEqual(['Atlas', 'Beacon', 'Cobalt', 'Delta', 'Ember']);
  });

  it('opens with Down on the chosen option and Up on the last, and moves over usable options', async () => {
    const { el, log } = await mount();
    await press(el, '{ArrowDown}');
    expect(open(el)).toBe(true);
    expect(active(el)).toBe('Cobalt');
    // Delta is disabled and skipped; the ends do not wrap.
    await press(el, '{ArrowDown}');
    expect(active(el)).toBe('Ember');
    await press(el, '{ArrowDown}');
    expect(active(el)).toBe('Ember');
    // Home and End stay with the text.
    await press(el, '{Home}');
    expect(active(el)).toBe('Ember');
    await press(el, '{Escape}');
    expect(open(el)).toBe(false);
    expect(input(el).hasAttribute('aria-activedescendant')).toBe(false);
    await press(el, '{ArrowUp}');
    expect(active(el)).toBe('Ember');
    await press(el, '{Alt>}{ArrowUp}{/Alt}');
    expect(open(el)).toBe(false);
    await press(el, '{Alt>}{ArrowDown}{/Alt}');
    expect(open(el)).toBe(true);
    expect(active(el)).toBeUndefined();
    // Enter with nothing active closes without a change.
    await press(el, '{Enter}');
    expect(open(el)).toBe(false);
    expect(log).toEqual([]);
  });

  it('reverts typed text on Escape and when focus leaves, and clears with Escape when closed', async () => {
    const { el, log } = await mount();
    await press(el, '{Control>}a{/Control}xyz');
    expect(shown(el)).toEqual([]);
    expect(part(el, 'empty').hidden).toBe(false);
    await press(el, '{Escape}');
    expect(open(el)).toBe(false);
    expect(input(el).value).toBe('Cobalt');
    await press(el, 'at');
    (container.querySelector('#after') as HTMLElement).focus();
    await settle(el);
    expect(open(el)).toBe(false);
    expect(input(el).value).toBe('Cobalt');
    expect(el.query).toBe('');
    expect(el.value).toBe('cobalt');
    // APG: Escape on a closed combobox clears it.
    await press(el, '{Escape}');
    expect(el.value).toBe('');
    expect(input(el).value).toBe('');
    expect(log.filter((line) => !line.startsWith('query'))).toEqual(['input ', 'change ']);
    // Nothing left to clear: Escape reaches outer handlers.
    let reached = false;
    container.addEventListener('keydown', (event) => (reached = event.key === 'Escape'));
    await press(el, '{Escape}');
    expect(reached).toBe(true);
  });

  it('opens on a click and chooses an option with a click, keeping focus in the input', async () => {
    const { el, log } = await mount();
    await userEvent.click(input(el));
    await settle(el);
    expect(open(el)).toBe(true);
    await userEvent.click(option(el, 'Delta'), { force: true });
    await settle(el);
    expect(el.value).toBe('cobalt');
    expect(open(el)).toBe(true);
    await userEvent.click(option(el, 'Atlas'));
    await settle(el);
    expect(el.value).toBe('atlas');
    expect(open(el)).toBe(false);
    expect(el.shadowRoot!.activeElement).toBe(input(el));
    expect(log).toEqual(['input atlas', 'change atlas']);
    // A press outside closes it (above it: the popup covers what is below).
    await userEvent.click(input(el));
    await settle(el);
    expect(open(el)).toBe(true);
    await userEvent.click(container.querySelector('#before')!);
    await settle(el);
    expect(open(el)).toBe(false);
  });

  it('clears with the clear button', async () => {
    const { el, log } = await mount();
    await userEvent.click(part(el, 'clear'));
    await settle(el);
    expect(el.value).toBe('');
    expect(part(el, 'clear').hidden).toBe(true);
    expect(el.shadowRoot!.activeElement).toBe(input(el));
    expect(log).toEqual(['input ', 'change ']);
    expect(part(el, 'clear').tabIndex).toBe(-1);
  });

  it('dispatches odd-query-change and leaves filtering to the page with no-filter', async () => {
    const { el, log } = await mount('label="Person" no-filter', '');
    el.addEventListener('odd-query-change', (event) => {
      const query = (event as CustomEvent<{ query: string }>).detail.query;
      el.options = ['Ada', 'Alan', 'Grace']
        .filter((name) => name.toLowerCase().startsWith(query.toLowerCase()))
        .map((name) => ({ value: name.toLowerCase(), label: name }));
    });
    await press(el, 'a');
    expect(shown(el)).toEqual(['Ada', 'Alan']);
    expect(active(el)).toBe('Ada');
    // The page's options are shown as given, even where the label does not contain the text.
    // Replacing the options drops an active option that is gone.
    el.options = [{ value: 'eve', label: 'Eve' }];
    await settle(el);
    expect(shown(el)).toEqual(['Eve']);
    expect(input(el).hasAttribute('aria-activedescendant')).toBe(false);
    await press(el, '{ArrowDown}{Enter}');
    expect(el.value).toBe('eve');
    expect(log).toEqual(['query a', 'input eve', 'change eve']);
  });

  it('chooses several values as chips with multiple', async () => {
    const { el, log, form } = await mount(
      'label="Topics" name="topics" multiple',
      PROJECTS.replace('value="atlas"', 'value="atlas" selected'),
    );
    expect(el.values).toEqual(['atlas', 'cobalt']);
    expect(chips(el)).toEqual(['Atlas', 'Cobalt']);
    expect(input(el).value).toBe('');
    expect(part(el, 'listbox').getAttribute('aria-multiselectable')).toBe('true');
    await expect
      .element(page.getByRole('list', { name: 'Selected', exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('button', { name: 'Remove Atlas', exact: true }))
      .toBeInTheDocument();
    // Rows carry a decorative check box; Enter toggles and the popup stays open.
    await press(el, 'e');
    expect(shown(el)).toEqual(['Beacon', 'Delta', 'Ember']);
    await press(el, '{ArrowDown}{ArrowDown}{Enter}');
    expect(el.values).toEqual(['atlas', 'cobalt', 'ember']);
    expect(open(el)).toBe(true);
    expect(option(el, 'Ember').getAttribute('aria-selected')).toBe('true');
    expect(option(el, 'Ember').querySelector('.indicator-box')!.getAttribute('data-state')).toBe(
      'checked',
    );
    expect(option(el, 'Beacon').querySelector('.indicator-box')!.hasAttribute('data-state')).toBe(
      false,
    );
    await press(el, '{Enter}');
    expect(el.values).toEqual(['atlas', 'cobalt']);
    // Backspace in the empty input removes the last value.
    await press(el, '{Escape}{Control>}a{/Control}{Backspace}{Backspace}');
    expect(el.values).toEqual(['atlas']);
    expect(new FormData(form).getAll('topics')).toEqual(['atlas']);
    expect(log.filter((line) => !line.startsWith('query'))).toEqual([
      'input atlas,cobalt,ember',
      'change atlas,cobalt,ember',
      'input atlas,cobalt',
      'change atlas,cobalt',
      'input atlas',
      'change atlas',
    ]);
    form.reset();
    await settle(el);
    expect(el.values).toEqual(['atlas', 'cobalt']);
  });

  it('moves between chips with the arrow keys and removes them with Delete or a click', async () => {
    const { el } = await mount(
      'label="Topics" multiple',
      PROJECTS.replace('value="atlas"', 'value="atlas" selected').replace(
        'value="ember"',
        'value="ember" selected',
      ),
    );
    expect(chips(el)).toEqual(['Atlas', 'Cobalt', 'Ember']);
    await press(el, '{ArrowLeft}');
    const removes = () => parts(el, 'chip-remove');
    expect(el.shadowRoot!.activeElement).toBe(removes()[2]);
    await userEvent.keyboard('{ArrowLeft}');
    expect(el.shadowRoot!.activeElement).toBe(removes()[1]);
    await userEvent.keyboard('{Delete}');
    await settle(el);
    expect(el.values).toEqual(['atlas', 'ember']);
    expect(el.shadowRoot!.activeElement).toBe(removes()[0]);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(input(el));
    await press(el, '{ArrowLeft}');
    await userEvent.keyboard('{Escape}');
    expect(el.shadowRoot!.activeElement).toBe(input(el));
    // With text before the caret, Left moves the caret, not to the chips.
    await press(el, 'ab{ArrowLeft}');
    expect(el.shadowRoot!.activeElement).toBe(input(el));
    await press(el, '{Control>}a{/Control}{Backspace}');
    await userEvent.click(removes()[0]!);
    await settle(el);
    expect(el.values).toEqual(['ember']);
    expect(el.shadowRoot!.activeElement).toBe(input(el));
  });

  it('collapses the chips that do not fit to "+N" while the field is not in use', async () => {
    const all = PROJECTS.replace('disabled', '').replace(/<option /g, '<option selected ');
    const { el } = await mount('label="Topics" multiple style="inline-size: 200px"', all);
    expect(el.values).toHaveLength(5);
    const visible = () =>
      parts(el, 'chip').filter((chip) => getComputedStyle(chip).visibility === 'visible');
    await expect.poll(() => visible().length).toBeLessThan(5);
    const count = visible().length;
    expect(part(el, 'more').hidden).toBe(false);
    expect(part(el, 'more').textContent).toContain(`+${5 - count}`);
    await expect.element(page.getByText(`${5 - count} more`, { exact: true })).toBeInTheDocument();
    // One line: the field keeps its single-row height.
    expect(part(el, 'control').getBoundingClientRect().height).toBeLessThan(60);
    input(el).focus();
    await settle(el);
    expect(visible()).toHaveLength(5);
    expect(part(el, 'more').hidden).toBe(true);
    // Collapsed again when focus leaves; wider (the page is about 400px wide), more fit.
    (container.querySelector('#after') as HTMLElement).focus();
    await expect.poll(() => visible().length).toBe(count);
    el.style.inlineSize = '100%';
    await expect.poll(() => visible().length).toBeGreaterThan(count);
    expect(part(el, 'more').textContent).toContain(`+${5 - visible().length}`);
  });

  it('submits, requires, resets, and restores like a native select', async () => {
    const { el, form } = await mount(
      'label="Project" name="project" required',
      PROJECTS.replace(' selected', ''),
    );
    expect(new FormData(form).get('project')).toBeNull();
    expect(el.validity.valueMissing).toBe(true);
    expect(input(el).getAttribute('aria-required')).toBe('true');
    expect(form.reportValidity()).toBe(false);
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(input(el));
    expect(input(el).getAttribute('aria-invalid')).toBe('true');
    expect(el.matches(':state(user-invalid)')).toBe(true);
    el.value = 'atlas';
    await settle(el);
    expect(input(el).value).toBe('Atlas');
    expect(new FormData(form).get('project')).toBe('atlas');
    expect(el.checkValidity()).toBe(true);
    // A reset also drops text the user was typing.
    await press(el, '{Control>}a{/Control}zz');
    form.reset();
    await settle(el);
    expect(el.value).toBe('');
    expect(input(el).value).toBe('');
    expect(el.query).toBe('');
  });

  it('cannot be changed when read-only or disabled, also by a disabled fieldset', async () => {
    const { el, log } = await mount('label="Project" name="project" readonly');
    expect(input(el).readOnly).toBe(true);
    expect(part(el, 'clear').hidden).toBe(true);
    await press(el, '{ArrowDown}');
    expect(open(el)).toBe(false);
    await press(el, '{Escape}');
    expect(el.value).toBe('cobalt');
    el.readonly = false;
    el.disabled = true;
    await settle(el);
    expect(input(el).disabled).toBe(true);
    expect(part(el, 'clear').hidden).toBe(true);
    await expect
      .poll(() => getComputedStyle(part(el, 'control')).backgroundColor)
      .toBe(themeValue('background-color', '--odd-color-surface-sunken'));
    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    el.disabled = false;
    container.querySelector('form')!.append(fieldset);
    fieldset.append(el);
    await settle(el);
    expect(input(el).disabled).toBe(true);
    expect(log).toEqual([]);
  });

  it('shows the error state once the user leaves a required, empty combobox', async () => {
    const { el } = await mount('label="Project" required', PROJECTS.replace(' selected', ''));
    input(el).focus();
    await settle(el);
    expect(input(el).hasAttribute('aria-invalid')).toBe(false);
    (container.querySelector('#after') as HTMLElement).focus();
    await settle(el);
    expect(input(el).getAttribute('aria-invalid')).toBe('true');
    expect(el.matches(':state(user-invalid)')).toBe(true);
  });

  it('shows the loading, empty, and status states in the popup', async () => {
    const { el } = await mount('label="Project" loading', '');
    await press(el, '{ArrowDown}');
    expect(open(el)).toBe(true);
    expect(part(el, 'loading').hidden).toBe(false);
    expect(part(el, 'loading').textContent!.trim()).toBe('Loading…');
    expect(part(el, 'empty').hidden).toBe(true);
    el.loading = false;
    await settle(el);
    await expect.element(page.getByText('No matching options')).toBeVisible();
    el.insertAdjacentHTML('beforeend', '<p slot="status" role="alert">Projects could not load</p>');
    await settle(el);
    await expect.element(page.getByRole('alert')).toHaveTextContent('Projects could not load');
    el.innerHTML = PROJECTS;
    el.loading = true;
    await expect.poll(() => options(el).length).toBe(5);
    expect(part(el, 'listbox').getAttribute('aria-busy')).toBe('true');
  });

  it('draws the control field and a raised popup at least as wide, with square rows between dividers', async () => {
    const { el } = await mount();
    const box = getComputedStyle(part(el, 'control'));
    expect(box.borderTopColor).toBe(themeValue('border-top-color', '--odd-color-border-strong'));
    // Figma's search glyph at the start (an adornment); the text starts after it.
    const glyph = el.shadowRoot!.querySelector('.control-start')!.getBoundingClientRect();
    expect(glyph.left - part(el, 'control').getBoundingClientRect().left).toBeCloseTo(
      parseFloat(themeValue('padding-inline-start', '--odd-control-padding-inline-md')),
      0,
    );
    expect(input(el).getBoundingClientRect().left).toBeGreaterThanOrEqual(glyph.right);
    expect(el.shadowRoot!.querySelector('.chevron')).toBeNull();
    await press(el, '{ArrowDown}');
    const popup = part(el, 'popup');
    const surface = getComputedStyle(popup);
    expect(surface.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-raised'),
    );
    expect(surface.boxShadow).not.toBe('none');
    expect(popup.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      input(el).getBoundingClientRect().width - 1,
    );
    expect(popup.getBoundingClientRect().top).toBeGreaterThan(
      input(el).getBoundingClientRect().bottom - 1,
    );
    const second = getComputedStyle(option(el, 'Beacon'));
    expect(second.borderTopWidth).toBe(themeValue('margin-top', '--odd-border-width-default'));
    expect(getComputedStyle(option(el, 'Cobalt')).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-selection-surface'),
    );
    expect(getComputedStyle(option(el, 'Cobalt')).outlineColor).toBe(
      themeValue('outline-color', '--odd-color-focus-ring'),
    );
    expect(option(el, 'Beacon').querySelector('.option-description')!.textContent).toBe('Archived');
  });

  it('draws the multiple box with its focus ring around the input', async () => {
    const { el } = await mount(
      'label="Topics" multiple',
      PROJECTS.replace('value="atlas"', 'value="atlas" selected'),
    );
    const box = part(el, 'control');
    expect(getComputedStyle(box).borderTopColor).toBe(
      themeValue('border-top-color', '--odd-color-border-strong'),
    );
    expect(getComputedStyle(box).paddingInlineStart).toBe(
      themeValue('padding-inline-start', '--odd-control-padding-inline-sm'),
    );
    expect(getComputedStyle(parts(el, 'chip')[0]!).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-sunken'),
    );
    await press(el, 'a');
    expect(getComputedStyle(box).outlineColor).toBe(
      themeValue('outline-color', '--odd-color-focus-ring'),
    );
    expect(getComputedStyle(input(el)).outlineStyle).toBe('none');
  });

  it.runIf(server.browser === 'chromium')(
    'marks the chosen option and disabled options in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el } = await mount();
        await press(el, '{ArrowDown}');
        const probe = document.createElement('span');
        probe.style.color = 'Highlight';
        container.append(probe);
        expect(getComputedStyle(option(el, 'Cobalt')).backgroundColor).toBe(
          getComputedStyle(probe).color,
        );
        probe.style.color = 'GrayText';
        expect(getComputedStyle(option(el, 'Delta')).color).toBe(getComputedStyle(probe).color);
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything when removed, also while open', async () => {
    const before = scopeStats();
    const { el } = await mount('label="Topics" multiple', PROJECTS);
    await press(el, 'a');
    expect(open(el)).toBe(true);
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
