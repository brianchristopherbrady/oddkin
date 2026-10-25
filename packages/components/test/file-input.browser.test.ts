import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinFileInput } from '../src/file-input/file-input.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-file-input (component-contracts.md §3.3; Figma fileUpload).
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  await userEvent.unhover(document.body);
  container.remove();
  flush();
});

const file = (name: string, size: number, type = 'application/pdf') =>
  new File([new Uint8Array(size)], name, { type });

async function mount(markup: string) {
  container.innerHTML = markup;
  const el = container.querySelector('odd-file-input') as OddkinFileInput;
  await settle(el);
  const part = (name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
  const control = el.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const native = container.querySelector<HTMLInputElement>('input[type="file"]');
  return { el, part, control, native, form: container.querySelector('form') };
}

const transfer = (files: File[]) => {
  const data = new DataTransfer();
  for (const f of files) data.items.add(f);
  return data;
};

/** Chooses files as the picker would: the input's files change, then `input` and `change`. */
async function choose(input: HTMLInputElement, files: File[]) {
  input.files = transfer(files).files;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Drags files (or `text` when given) onto `target`, as the browser dispatches it. */
function drop(
  target: Element,
  files: File[],
  steps: ('dragenter' | 'dragover' | 'dragleave' | 'drop')[],
  text?: string,
) {
  const dataTransfer = transfer(files);
  if (text) dataTransfer.setData('text/plain', text);
  return steps.map((type) => {
    const event = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      dataTransfer,
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

const entries = (form: HTMLFormElement, name: string) =>
  new FormData(form)
    .getAll(name)
    .map((v) => (v instanceof File ? `${v.name}:${v.size}:${v.type}` : v));
const box = (el: Element) => el.getBoundingClientRect();
/** Waits out a transition on `::file-selector-button`, which `getAnimations()` does not list. */
const pseudoTransitions = () =>
  new Promise((resolve) =>
    setTimeout(
      resolve,
      parseFloat(themeValue('transition-duration', '--odd-motion-duration-fast')) * 1000 + 100,
    ),
  );

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/file-input/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'FILE_INPUT_STRINGS',
        'OddkinFileInput',
        'fieldStructuralStyles',
        'fileInputStructuralStyles',
        'fileInputTemplate',
        'glyphStyles',
        'hostStyles',
      ].sort(),
    );
    const index = await import('../src/file-input/index.js');
    expect(Object.keys(index)).toContain('fileInputDefinition');
  });
});

describe('odd-file-input', () => {
  it('is a native file input named by its label and described by its help and error', async () => {
    const { el, part, control } = await mount(
      `<odd-file-input label="Project attachments" description="PDF, up to 10 MB." accept=".pdf" multiple required></odd-file-input>`,
    );
    expect(control.type).toBe('file');
    expect(control.labels![0]).toBe(part('label'));
    expect([control.accept, control.multiple, control.required]).toEqual(['.pdf', true, true]);
    expect(control.getAttribute('aria-describedby')).toBe('description');
    expect(part('title').textContent!.trim()).toBe('Choose files or drop them here');
    el.error = 'The file is too large.';
    await settle(el);
    expect(control.getAttribute('aria-describedby')).toBe('description error');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    // The error takes the title's place.
    expect([part('title').hidden, part('error').hidden]).toEqual([true, false]);
    el.error = '';
    el.multiple = false;
    el.strings = { title: 'Datei wählen oder hier ablegen' };
    await settle(el);
    expect([part('title').hidden, part('error').hidden]).toEqual([false, true]);
    expect(part('title').textContent!.trim()).toBe('Datei wählen oder hier ablegen');
    // Without a label or help text, neither shows; the tooltip hook adds its text.
    el.label = '';
    el.description = '';
    el._describe(container, 'Opens the browser’s picker');
    await settle(el);
    expect([part('label').hidden, part('description').hidden]).toEqual([true, true]);
    expect(control.getAttribute('aria-describedby')).toBe('external-description');
    expect(el.shadowRoot!.getElementById('external-description')!.textContent).toBe(
      'Opens the browser’s picker',
    );
    // Focus goes to the input; leaving a required, empty field shows its error state.
    el.focus();
    expect(el.shadowRoot!.activeElement).toBe(control);
    expect(el.matches(':state(user-invalid)')).toBe(false);
    control.blur();
    await settle(el);
    expect(el.matches(':state(user-invalid)')).toBe(true);
  });

  it('submits the chosen files under its name, as a native file input does', async () => {
    const { el, control, native, form } = await mount(
      `<form><odd-file-input name="files" multiple></odd-file-input><input type="file" name="native" multiple /></form>`,
    );
    // No file: one empty, unnamed file, as native.
    expect(entries(form!, 'files')).toEqual(entries(form!, 'native'));
    const files = [file('brief.pdf', 2400), file('logo.png', 900, 'image/png')];
    await choose(control, files);
    await choose(native!, files);
    await settle(el);
    expect(entries(form!, 'files')).toEqual([
      'brief.pdf:2400:application/pdf',
      'logo.png:900:image/png',
    ]);
    expect(entries(form!, 'files')).toEqual(entries(form!, 'native'));
    expect(el.files.map((f) => f.name)).toEqual(['brief.pdf', 'logo.png']);
  });

  it('lists the files with their size, and removes one with its button', async () => {
    const { el, part, control } = await mount(
      `<odd-file-input label="Attachments" name="files" multiple></odd-file-input>`,
    );
    const events: string[] = [];
    // `input` crosses the shadow boundary, as native.
    el.addEventListener('input', (event) => events.push(event.composed ? 'input' : 'uncomposed'));
    el.addEventListener('change', () => events.push('change'));
    await choose(control, [file('brief.pdf', 2_400_000), file('logo.png', 900, 'image/png')]);
    await settle(el);
    expect(events).toEqual(['input', 'change']);
    const rows = () => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="file"]')];
    expect(rows().map((row) => row.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'brief.pdf 2.4 MB',
      'logo.png 900 byte',
    ]);
    const remove = rows()[0]!.querySelector<HTMLButtonElement>('[part~="remove"]')!;
    expect(remove.getAttribute('aria-label')).toBe('Remove brief.pdf');
    await userEvent.click(remove);
    await settle(el);
    expect(el.files.map((f) => f.name)).toEqual(['logo.png']);
    expect([...control.files!].map((f) => f.name)).toEqual(['logo.png']);
    expect(events).toEqual(['input', 'change', 'input', 'change']);
    // Focus moves to the row that took its place, then to the input.
    const next = rows()[0]!.querySelector('[part~="remove"]');
    expect(el.shadowRoot!.activeElement).toBe(next);
    await userEvent.click(next!);
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(control);
    expect(part('files').hidden).toBe(true);
    // A later choice leaves focus where it is.
    await choose(control, [file('a.pdf', 1), file('b.pdf', 1), file('c.pdf', 1)]);
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(control);
    // Removing the last row moves focus to the row before it.
    await userEvent.click(rows()[2]!.querySelector('[part~="remove"]')!);
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(rows()[1]!.querySelector('[part~="remove"]'));
  });

  it('writes sizes in the page language, in powers of 1,000 up to gigabytes', async () => {
    const { el } = await mount(`<odd-file-input label="Files"></odd-file-input>`);
    expect([999, 1000, 2_400_000, 2e12].map((bytes) => el._size(bytes))).toEqual([
      '999 byte',
      '1 kB',
      '2.4 MB',
      '2,000 GB',
    ]);
    el.lang = 'de';
    expect(el._size(2_400_000)).toBe(
      new Intl.NumberFormat('de', { style: 'unit', unit: 'megabyte', unitDisplay: 'short' }).format(
        2.4,
      ),
    );
  });

  it('takes files dropped on its surface, one unless multiple, and marks the drop target', async () => {
    const { el, part, control } = await mount(
      `<odd-file-input label="Attachments" name="files"></odd-file-input>`,
    );
    const events: string[] = [];
    el.addEventListener('input', () => events.push('input'));
    el.addEventListener('change', () => events.push('change'));
    const files = [file('a.pdf', 1), file('b.pdf', 2)];
    // Text, not files: neither a target nor a drop.
    expect(drop(part('surface'), [], ['dragenter', 'dragover'], 'Hello')).toEqual([false, false]);
    expect(el.matches(':state(drop-target)')).toBe(false);
    drop(part('surface'), [], ['dragleave'], 'Hello');
    // A stray dragleave (the drag started inside) does not unbalance the count.
    drop(part('surface'), files, ['dragleave']);
    // Entering a child after the surface keeps the state until the drag leaves both.
    expect(drop(part('surface'), files, ['dragenter', 'dragover'])).toEqual([false, true]);
    expect(el.matches(':state(drop-target)')).toBe(true);
    drop(part('title'), files, ['dragenter']);
    drop(part('surface'), files, ['dragleave']);
    expect(el.matches(':state(drop-target)')).toBe(true);
    drop(part('title'), files, ['dragleave']);
    expect(el.matches(':state(drop-target)')).toBe(false);
    expect(drop(part('title'), files, ['dragenter', 'drop'])).toEqual([false, true]);
    await settle(el);
    expect(el.matches(':state(drop-target)')).toBe(false);
    // No dragleave follows a drop: the next drag counts from zero.
    drop(part('surface'), files, ['dragenter', 'dragleave']);
    expect(el.matches(':state(drop-target)')).toBe(false);
    expect(el.files.map((f) => f.name)).toEqual(['a.pdf']);
    expect([...control.files!].map((f) => f.name)).toEqual(['a.pdf']);
    expect(events).toEqual(['input', 'change']);
    el.multiple = true;
    await settle(el);
    drop(part('surface'), files, ['dragenter', 'dragover', 'drop']);
    await settle(el);
    expect(el.files.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
    // A drop without files (text) changes nothing.
    expect(drop(part('surface'), [], ['dragenter', 'dragover', 'drop'], 'Hello')).toEqual([
      false,
      false,
      false,
    ]);
    await settle(el);
    expect(el.files.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(events).toEqual(['input', 'change', 'input', 'change']);
    // Disabled, it takes nothing and lets the browser have the drop.
    el.disabled = true;
    await settle(el);
    drop(part('surface'), [file('c.pdf', 1)], ['dragenter']);
    expect(el.matches(':state(drop-target)')).toBe(false);
    drop(part('surface'), [file('c.pdf', 1)], ['dragleave']);
    expect(drop(part('surface'), [file('c.pdf', 1)], ['dragenter', 'dragover', 'drop'])).toEqual([
      false,
      false,
      false,
    ]);
    expect(el.matches(':state(drop-target)')).toBe(false);
    expect(el.files.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
    // Its buttons and texts take the disabled look.
    for (const animation of el.shadowRoot!.getAnimations()) animation.finish();
    await pseudoTransitions();
    const disabled = themeValue('color', '--odd-color-text-disabled');
    const remove = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="remove"]')!;
    expect(remove.disabled).toBe(true);
    const picker = getComputedStyle(control, '::file-selector-button');
    expect([
      getComputedStyle(part('label')).color,
      getComputedStyle(part('title')).color,
      getComputedStyle(remove).color,
      picker.color,
      picker.borderTopColor,
    ]).toEqual([disabled, disabled, disabled, disabled, 'rgba(0, 0, 0, 0)']);
  });

  it('blocks a required, empty submission and points the browser at the input', async () => {
    const { el, control, form } = await mount(
      `<form><odd-file-input label="Contract" name="contract"></odd-file-input><button>Send</button></form>`,
    );
    expect(el.validity.valid).toBe(true);
    el.required = true;
    await settle(el);
    expect(el.validity.valueMissing).toBe(true);
    expect(el.validationMessage).toBe(control.validationMessage);
    expect(form!.checkValidity()).toBe(false);
    await choose(control, [file('contract.pdf', 10)]);
    await settle(el);
    expect(el.validity.valid).toBe(true);
  });

  it('clears on reset and follows a disabled fieldset, as native', async () => {
    const { el, control, native, form } = await mount(
      `<form><fieldset><odd-file-input label="Files" name="files"></odd-file-input><input type="file" name="native" /></fieldset></form>`,
    );
    await choose(control, [file('a.pdf', 1)]);
    await choose(native!, [file('a.pdf', 1)]);
    await settle(el);
    form!.reset();
    await settle(el);
    expect([el.files.length, control.files!.length, native!.files!.length]).toEqual([0, 0, 0]);
    expect(entries(form!, 'files')).toEqual(entries(form!, 'native'));
    form!.querySelector('fieldset')!.disabled = true;
    await settle(el);
    expect([control.matches(':disabled'), native!.matches(':disabled')]).toEqual([true, true]);
    expect([...new FormData(form!).keys()]).toEqual([]);
    // A disabled fieldset also refuses drops.
    const surface = el.shadowRoot!.querySelector('[part~="surface"]')!;
    expect(drop(surface, [file('b.pdf', 1)], ['dragenter', 'dragover', 'drop'])).toEqual([
      false,
      false,
      false,
    ]);
    expect(el.files).toEqual([]);
  });

  it('takes the Tab order of a native file input, then its remove buttons', async () => {
    const { el, control } = await mount(
      `<button id="before">Before</button><odd-file-input label="Files" multiple></odd-file-input><button id="after">After</button>`,
    );
    await choose(control, [file('a.pdf', 1), file('b.pdf', 1)]);
    await settle(el);
    container.querySelector<HTMLButtonElement>('#before')!.focus();
    const stops: string[] = [];
    for (let i = 0; i < 4; i++) {
      await userEvent.tab();
      const inner = el.shadowRoot!.activeElement as HTMLElement | null;
      stops.push(
        document.activeElement === el
          ? (inner?.getAttribute('aria-label') ?? inner?.localName ?? '')
          : document.activeElement!.id,
      );
    }
    expect(stops).toEqual(['input', 'Remove a.pdf', 'Remove b.pdf', 'after']);
  });

  it('draws the selector button with the secondary button’s tokens, and only the button', async () => {
    const { control } = await mount(`<odd-file-input label="Files"></odd-file-input>`);
    container.insertAdjacentHTML('beforeend', '<odd-button>Choose</odd-button>');
    const button = container.querySelector('odd-button')!;
    await settle(button);
    const inner = button.shadowRoot!.querySelector('button')!;
    const picker = getComputedStyle(control, '::file-selector-button');
    const look = getComputedStyle(inner);
    for (const property of [
      'background-color',
      'border-top-color',
      'border-top-width',
      'border-start-start-radius',
      'padding-inline-start',
      'min-block-size',
      'color',
      'font-size',
      'font-weight',
      'line-height',
    ])
      expect(picker.getPropertyValue(property), property).toBe(look.getPropertyValue(property));
    // The input's own file-count text takes no room: the input is as wide as its button.
    const native = document.createElement('input');
    native.type = 'file';
    container.append(native);
    expect(box(control).width).toBeLessThan(box(native).width);
  });

  it('lays out Figma fileUpload: the surface, the glyph and title, the indented help and button', async () => {
    const { el, part, control } = await mount(
      `<odd-file-input label="Project attachments" description="PDF, PNG, JPG · Maximum 10 MB"></odd-file-input>`,
    );
    const surface = getComputedStyle(part('surface'));
    expect(surface.backgroundColor).toBe(themeValue('color', '--odd-color-surface-default'));
    expect(surface.borderTopColor).toBe(themeValue('color', '--odd-color-border-strong'));
    expect(surface.borderStartStartRadius).toBe(
      themeValue('border-top-left-radius', '--odd-card-radius'),
    );
    const glyph = el.shadowRoot!.querySelector('.header-glyph')!;
    const lg = parseFloat(themeValue('inline-size', '--odd-icon-size-lg'));
    const md = parseFloat(themeValue('inline-size', '--odd-space-md'));
    expect(box(glyph).width).toBe(lg);
    expect(Math.round(box(part('title')).left - box(glyph).right)).toBe(Math.round(md));
    for (const indented of [part('description'), control])
      expect(Math.round(box(indented).left)).toBe(Math.round(box(part('title')).left));
    expect(getComputedStyle(part('title')).color).toBe(
      themeValue('color', '--odd-color-text-primary'),
    );
    el.error = 'File is too large';
    await settle(el);
    expect(getComputedStyle(part('error')).color).toBe(
      themeValue('color', '--odd-color-danger-foreground'),
    );
    expect(getComputedStyle(part('error')).fontSize).toBe(getComputedStyle(part('label')).fontSize);
    // A drop target takes the action border and the selection surface.
    drop(part('surface'), [file('a.pdf', 1)], ['dragenter']);
    for (const animation of part('surface').getAnimations()) animation.finish();
    expect(getComputedStyle(part('surface')).borderTopColor).toBe(
      themeValue('color', '--odd-color-action-default'),
    );
    expect(getComputedStyle(part('surface')).backgroundColor).toBe(
      themeValue('color', '--odd-color-selection-surface'),
    );
  });

  it('spaces the surface, rows, and remove buttons by their tokens, at any width', async () => {
    const { el, part, control } = await mount(
      `<odd-file-input label="Project attachments" description="PDF, PNG, JPG · Maximum 10 MB" multiple></odd-file-input>`,
    );
    await choose(control, [file('brief.pdf', 2_400_000), file('logo.png', 900, 'image/png')]);
    await settle(el);
    const px = (property: string, token: string) => parseFloat(themeValue(property, token));
    expect(getComputedStyle(el).display).toBe('block');
    const surface = getComputedStyle(part('surface'));
    expect(surface.paddingTop).toBe(themeValue('padding-top', '--odd-card-padding'));
    expect(surface.rowGap).toBe(themeValue('row-gap', '--odd-space-xs'));
    expect(getComputedStyle(el.shadowRoot!.querySelector('.header-glyph')!).color).toBe(
      themeValue('color', '--odd-color-text-secondary'),
    );
    expect(getComputedStyle(control).marginTop).toBe(themeValue('margin-top', '--odd-space-xs'));
    expect(getComputedStyle(control, '::file-selector-button').marginInlineEnd).toBe('0px');
    // The header and the rows span the surface; the rows start where the header does.
    const header = el.shadowRoot!.querySelector('.header')!;
    const inner = box(part('surface')).width - 2 * parseFloat(surface.paddingLeft) - 2;
    expect(box(header).width).toBeCloseTo(inner, 0);
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="file"]')];
    expect(getComputedStyle(part('files')).rowGap).toBe(themeValue('row-gap', '--odd-space-sm'));
    for (const row of rows) {
      expect(box(row).width).toBeCloseTo(inner, 0);
      expect(box(row).left).toBeCloseTo(box(header).left, 0);
      // The name over the size; the remove button at the end of the row.
      const [name, size] = [row.querySelector('.file-name')!, row.querySelector('.file-size')!];
      expect(box(size).top).toBeGreaterThanOrEqual(box(name).bottom - 1);
      const remove = row.querySelector<HTMLElement>('[part~="remove"]')!;
      expect(box(remove).right).toBeCloseTo(box(row).right, 0);
      const sm = px('block-size', '--odd-control-height-sm');
      expect([box(remove).width, box(remove).height]).toEqual([sm, sm]);
      const style = getComputedStyle(remove);
      expect([style.color, style.borderTopWidth]).toEqual([
        themeValue('color', '--odd-color-text-secondary'),
        '0px',
      ]);
      expect(box(remove.querySelector('svg')!).width).toBe(px('inline-size', '--odd-icon-size-md'));
    }
    // Narrow: the glyph keeps its size, the title wraps, and the button stays inside.
    container.style.inlineSize = '160px';
    el.multiple = false;
    await settle(el);
    const glyph = el.shadowRoot!.querySelector('.header-glyph')!;
    expect(box(glyph).width).toBe(px('inline-size', '--odd-icon-size-lg'));
    expect(box(control).right).toBeLessThanOrEqual(box(part('surface')).right);
  });

  it('gives the picker button the secondary button’s hover and pressed looks', async () => {
    const { el, control } = await mount(`<odd-file-input label="Files"></odd-file-input>`);
    const background = async () => {
      await pseudoTransitions();
      return getComputedStyle(control, '::file-selector-button').backgroundColor;
    };
    await userEvent.hover(control);
    expect(await background()).toBe(themeValue('color', '--odd-color-surface-hover'));
    if (server.browser !== 'chromium') return;
    // Pressed, through CDP: a release away from the input opens no file chooser.
    const session = cdp();
    const { x, y } = box(control);
    const mouse = (type: 'mousePressed' | 'mouseMoved' | 'mouseReleased', x: number, y: number) =>
      session.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    await mouse('mousePressed', x + 4, y + 4);
    expect(await background()).toBe(themeValue('color', '--odd-color-surface-sunken'));
    await mouse('mouseMoved', 1, 1);
    await mouse('mouseReleased', 1, 1);
  });

  it.runIf(server.browser === 'chromium')(
    'keeps its surface, rows, and buttons in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el, part, control } = await mount(
          `<odd-file-input label="Files"></odd-file-input>`,
        );
        await choose(control, [file('a.pdf', 1)]);
        await settle(el);
        const probe = document.createElement('span');
        probe.style.color = 'ButtonText';
        container.append(probe);
        const remove = el.shadowRoot!.querySelector('[part~="remove"]')!;
        expect(getComputedStyle(remove).color).toBe(getComputedStyle(probe).color);
        probe.style.color = 'CanvasText';
        expect(getComputedStyle(part('surface')).borderTopColor).toBe(
          getComputedStyle(probe).color,
        );
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything it owns when removed', async () => {
    const before = scopeStats();
    const { el, control } = await mount(`<odd-file-input label="Files"></odd-file-input>`);
    await choose(control, [file('a.pdf', 1)]);
    await settle(el);
    el.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
