import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { loadTheme } from './probe.js';

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
};

describe('imports', () => {
  it('the foundation and the component entry register nothing', async () => {
    const foundation = await import('../src/button/foundation.js');
    const entry = await import('../src/button/index.js');
    expect(foundation.OddkinButton).toBe(entry.OddkinButton);
    expect(Object.keys(foundation).sort()).toEqual([
      'OddkinButton',
      'buttonStructuralStyles',
      'buttonTemplate',
      'changeEvent',
      'hostStyles',
      'inputEvent',
      'spinnerStyles',
    ]);
    expect(customElements.get('odd-button')).toBeUndefined();
    await import('../src/button/button.define.js');
    expect(customElements.get('odd-button')).toBe(entry.OddkinButton);
  });
});

async function mount(markup = 'Save', attributes: Record<string, string> = {}) {
  await import('../src/button/button.define.js');
  const el = document.createElement('odd-button');
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  el.innerHTML = markup;
  container.append(el);
  await settle(el);
  const control = el.shadowRoot!.querySelector('button')!;
  return { el, control };
}

describe('odd-button', () => {
  it('renders a native button with parts, slots, and defaults', async () => {
    const { el, control } = await mount();
    expect(control.type).toBe('button');
    expect(control.getAttribute('part')).toBe('control');
    expect(el.shadowRoot!.querySelector('[part="spinner"]')!.hasAttribute('hidden')).toBe(true);
    expect([...el.shadowRoot!.querySelectorAll('slot')].map((s) => s.name)).toEqual([
      'start',
      '',
      'end',
    ]);
    expect(el.appearance).toBe('secondary');
    expect(el.size).toBe('md');
    expect(el.type).toBe('button');
    expect(el.getAttribute('appearance')).toBe('secondary');
    // Shared host defaults, structural styles, shared spinner and focus ring, default visual styles.
    expect(el.shadowRoot!.adoptedStyleSheets).toHaveLength(5);
  });

  it('converts attributes and reflects appearance, size, disabled, loading, and full-width', async () => {
    const { el, control } = await mount('Go', { appearance: 'primary', 'full-width': '' });
    expect(el.appearance).toBe('primary');
    expect(el.fullWidth).toBe(true);
    el.size = 'lg';
    el.disabled = true;
    el.loading = true;
    await settle(el);
    expect(el.getAttribute('size')).toBe('lg');
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.hasAttribute('loading')).toBe(true);
    expect(control.disabled).toBe(true);
    expect(control.getAttribute('aria-disabled')).toBe('true');
    el.disabled = false;
    el.loading = false;
    el.fullWidth = false;
    await settle(el);
    expect(el.hasAttribute('full-width')).toBe(false);
    expect(control.hasAttribute('aria-disabled')).toBe(false);
  });

  it('names icon-only buttons through label', async () => {
    const { el, control } = await mount('<svg aria-hidden="true"></svg>', { label: 'Close' });
    expect(control.getAttribute('aria-label')).toBe('Close');
    el.label = '';
    await settle(el);
    expect(control.hasAttribute('aria-label')).toBe(false);
  });

  it('activates with click, Enter, and Space; delegates focus to the native button', async () => {
    const { el, control } = await mount();
    let clicks = 0;
    el.addEventListener('click', () => clicks++);
    await userEvent.click(el);
    expect(clicks).toBe(1);
    el.focus();
    expect(document.activeElement).toBe(el);
    expect(el.shadowRoot!.activeElement).toBe(control);
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(clicks).toBe(3);
  });

  it('ignores activation while disabled or loading; loading stays focusable', async () => {
    const { el, control } = await mount();
    let clicks = 0;
    el.addEventListener('click', () => clicks++);
    el.disabled = true;
    await settle(el);
    el.click();
    control.click();
    expect(clicks).toBe(0);
    el.disabled = false;
    el.loading = true;
    await settle(el);
    el.focus();
    expect(el.shadowRoot!.activeElement).toBe(control);
    await userEvent.keyboard('{Enter}');
    el.click();
    expect(clicks).toBe(0);
    expect(el.shadowRoot!.querySelector('[part="spinner"]')!.hasAttribute('hidden')).toBe(false);
  });

  it('programmatic property changes emit no events', async () => {
    const { el } = await mount();
    const events: string[] = [];
    for (const type of ['click', 'input', 'change'])
      el.addEventListener(type, () => events.push(type));
    el.appearance = 'ghost';
    el.disabled = true;
    el.loading = true;
    el.value = 'x';
    await settle(el);
    expect(events).toEqual([]);
  });
});

describe('forms', () => {
  async function form(button: string, fields = '<input name="q" value="initial" />') {
    await import('../src/button/button.define.js');
    const f = document.createElement('form');
    f.innerHTML = `${fields}${button}`;
    container.append(f);
    const el = f.querySelector('odd-button')!;
    await settle(el);
    const submits: SubmitEvent[] = [];
    const data: [string, FormDataEntryValue][][] = [];
    f.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
      // The submitter exists only during dispatch; read form data synchronously.
      data.push([...new FormData(f, event.submitter)]);
    });
    return { f, el, submits, data };
  }
  const nextTask = () => new Promise((resolve) => setTimeout(resolve, 10));

  it('submits with its name and value through a temporary native submitter', async () => {
    const { f, el, submits, data } = await form(
      '<odd-button type="submit" name="intent" value="save">Save</odd-button>',
    );
    expect(el.form).toBe(f);
    await userEvent.click(el);
    await nextTask();
    expect(submits).toHaveLength(1);
    const submitter = submits[0]!.submitter as HTMLButtonElement;
    expect(submitter.localName).toBe('button');
    expect(data[0]).toEqual([
      ['q', 'initial'],
      ['intent', 'save'],
    ]);
    // The temporary submitter is gone after dispatch; name/value are not submitted otherwise.
    expect(submitter.isConnected).toBe(false);
    expect(f.querySelectorAll('button')).toHaveLength(0);
    expect([...new FormData(f)]).toEqual([['q', 'initial']]);
    // Only native submit buttons are accepted as an explicit submitter.
    expect(() => f.requestSubmit(el)).toThrow(TypeError);
    expect(submits).toHaveLength(1);
  });

  it('runs constraint validation before submitting', async () => {
    const { f, el, submits } = await form(
      '<odd-button type="submit">Save</odd-button>',
      '<input name="q" required />',
    );
    let invalid = 0;
    // Suppress the validation bubble, which Firefox shows late and which swallows later clicks.
    f.querySelector('input')!.addEventListener('invalid', (event) => {
      invalid++;
      event.preventDefault();
    });
    await userEvent.click(el);
    await expect.poll(() => invalid).toBe(1);
    expect(submits).toHaveLength(0);
  });

  it('does not submit when the click is cancelled or the type is button', async () => {
    const { el, submits } = await form('<odd-button type="submit">Save</odd-button>');
    document.addEventListener('click', (event) => event.preventDefault(), { once: true });
    await userEvent.click(el);
    await nextTask();
    expect(submits).toHaveLength(0);
    el.type = 'button';
    await userEvent.click(el);
    await nextTask();
    expect(submits).toHaveLength(0);
  });

  it('resets the form with type="reset"', async () => {
    const { f, el } = await form('<odd-button type="reset">Reset</odd-button>');
    const input = f.querySelector('input')!;
    input.value = 'changed';
    await userEvent.click(el);
    await nextTask();
    expect(input.value).toBe('initial');
  });

  it('follows a disabled fieldset', async () => {
    const { f, el, submits } = await form(
      '<fieldset disabled><odd-button type="submit">Save</odd-button></fieldset>',
    );
    const control = el.shadowRoot!.querySelector('button')!;
    expect(control.disabled).toBe(true);
    el.click();
    await nextTask();
    expect(submits).toHaveLength(0);
    f.querySelector('fieldset')!.disabled = false;
    await settle(el);
    expect(control.disabled).toBe(false);
  });

  it('passes the submission overrides to the submitter; formnovalidate skips validation', async () => {
    const { f, el, submits, data } = await form(
      `<odd-button type="submit" name="intent" value="draft" formaction="/drafts"
        formmethod="post" formenctype="multipart/form-data" formtarget="drafts" formnovalidate
        >Save draft</odd-button>`,
      '<input name="q" required />',
    );
    expect([el.formAction, el.formMethod, el.formEnctype, el.formTarget]).toEqual([
      '/drafts',
      'post',
      'multipart/form-data',
      'drafts',
    ]);
    expect(el.formNoValidate).toBe(true);
    // Submitting would navigate a frame named "drafts"; the listener cancels it.
    await userEvent.click(el);
    await expect.poll(() => submits.length).toBe(1);
    const submitter = submits[0]!.submitter as HTMLButtonElement;
    expect(submitter.formAction).toBe(new URL('/drafts', document.baseURI).href);
    expect([submitter.formMethod, submitter.formEnctype, submitter.formTarget]).toEqual([
      'post',
      'multipart/form-data',
      'drafts',
    ]);
    expect(submitter.formNoValidate).toBe(true);
    expect(data[0]).toEqual([
      ['q', ''],
      ['intent', 'draft'],
    ]);
    // Properties reflect, and a button without overrides leaves the form's values in charge.
    el.formAction = '/other';
    el.formNoValidate = false;
    await settle(el);
    expect(el.getAttribute('formaction')).toBe('/other');
    expect(el.hasAttribute('formnovalidate')).toBe(false);
    for (const name of ['formaction', 'formmethod', 'formenctype', 'formtarget'])
      el.removeAttribute(name);
    f.querySelector('input')!.value = 'filled';
    await settle(el);
    await userEvent.click(el);
    await expect.poll(() => submits.length).toBe(2);
    const plain = submits[1]!.submitter as HTMLButtonElement;
    expect(
      ['formaction', 'formmethod', 'formenctype', 'formtarget'].map((n) => plain.hasAttribute(n)),
    ).toEqual([false, false, false, false]);
    expect(plain.formNoValidate).toBe(false);
  });

  it('submits the form it is associated with as its form attribute or position changes', async () => {
    await import('../src/button/button.define.js');
    container.innerHTML = `
      <form id="a"><input name="q" value="a" /></form>
      <form id="b"><input name="q" value="b" /></form>
      <odd-button type="submit" form="a" name="intent" value="go">Go</odd-button>`;
    const el = container.querySelector('odd-button')!;
    await settle(el);
    const submitted: string[] = [];
    for (const f of container.querySelectorAll('form'))
      f.addEventListener('submit', (event) => {
        event.preventDefault();
        const entries = [...new FormData(f, event.submitter)].map(([k, v]) => `${k}=${v}`);
        submitted.push(`${f.id}:${entries.join('&')}`);
      });
    const forms = [...container.querySelectorAll('form')];
    expect(el.form).toBe(forms[0]);
    await userEvent.click(el);
    await expect.poll(() => submitted.length).toBe(1);
    el.setAttribute('form', 'b');
    expect(el.form).toBe(forms[1]);
    await userEvent.click(el);
    await expect.poll(() => submitted.length).toBe(2);
    // Outside any form, activation submits nothing.
    el.removeAttribute('form');
    expect(el.form).toBe(null);
    el.click();
    await nextTask();
    forms[0]!.append(el);
    await settle(el);
    await userEvent.click(el);
    await expect.poll(() => submitted.length).toBe(3);
    expect(submitted).toEqual(['a:q=a&intent=go', 'b:q=b&intent=go', 'a:q=a&intent=go']);
  });

  it('is never the default button for Enter in a text field (documented limitation)', async () => {
    const { f, submits, data } = await form(
      '<odd-button type="submit" name="intent" value="save">Save</odd-button>',
    );
    const field = f.querySelector('input')!;
    // Without a native submit button, a form with one text field submits with no submitter.
    field.focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => submits.length).toBe(1);
    expect(submits[0]!.submitter).toBe(null);
    expect(data[0]).toEqual([['q', 'initial']]);
    // A native submit button later in the form is the default button instead.
    f.insertAdjacentHTML('beforeend', '<button name="native" value="1">Native</button>');
    field.focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => submits.length).toBe(2);
    expect((submits[1]!.submitter as HTMLButtonElement).name).toBe('native');
    // With two text fields and no native submit button, Enter does not submit.
    f.querySelector('button')!.remove();
    f.insertAdjacentHTML('afterbegin', '<input name="other" />');
    field.focus();
    await userEvent.keyboard('{Enter}');
    await nextTask();
    expect(submits).toHaveLength(2);
  });
});

describe('ownership and theming', () => {
  it('returns to baseline after reconnects and keeps nodes across theme-value changes', async () => {
    const { el, control } = await mount();
    const before = scopeStats();
    for (let i = 0; i < 10; i++) {
      el.remove();
      container.append(el);
      await settle(el);
    }
    expect(scopeStats()).toEqual(before);
    container.style.setProperty('--odd-button-radius', '0px');
    // The default (secondary) appearance reads color.surface.default.
    container.style.setProperty('--odd-color-surface-default', 'rgb(1, 2, 3)');
    await settle(el);
    expect(el.shadowRoot!.querySelector('button')).toBe(control);
    expect(getComputedStyle(control).borderTopLeftRadius).toBe('0px');
    expect(getComputedStyle(control).backgroundColor).toBe('rgb(1, 2, 3)');
  });
});

describe('toggle', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

  it('reports aria-pressed only with toggle, and the pressed state by role', async () => {
    const { el, control } = await mount('Bold');
    expect(control.hasAttribute('aria-pressed')).toBe(false);
    el.toggle = true;
    await settle(el);
    expect(control.getAttribute('aria-pressed')).toBe('false');
    el.pressed = true;
    await settle(el);
    expect(el.hasAttribute('pressed')).toBe(true);
    expect(page.getByRole('button', { name: 'Bold', pressed: true }).element()).toBe(control);
  });

  it('flips pressed on click, Enter, and Space: click sees the new state, then input and change', async () => {
    const { el } = await mount('Bold', { toggle: '' });
    const events: string[] = [];
    el.addEventListener('click', () => events.push(`click:${el.pressed}`));
    el.addEventListener('input', () => events.push(`input:${el.pressed}`));
    el.addEventListener('change', (e) => events.push(`change:${e.composed}`));
    await userEvent.click(el);
    await expect.poll(() => events.length).toBe(3);
    expect(events).toEqual(['click:true', 'input:true', 'change:false']);
    el.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await expect.poll(() => events.length).toBe(9);
    expect(el.pressed).toBe(true);
  });

  it('a cancelled click, disabled, or loading leaves pressed unchanged and dispatches nothing', async () => {
    const { el } = await mount('Bold', { toggle: '' });
    const events: string[] = [];
    for (const type of ['input', 'change']) el.addEventListener(type, () => events.push(type));
    el.addEventListener('click', (event) => event.preventDefault(), { once: true });
    await userEvent.click(el);
    await tick();
    expect([el.pressed, events]).toEqual([false, []]);
    el.disabled = true;
    await settle(el);
    el.click();
    el.disabled = false;
    el.loading = true;
    await settle(el);
    el.click();
    await tick();
    expect([el.pressed, events]).toEqual([false, []]);
  });

  it('programmatic pressed changes dispatch nothing', async () => {
    const { el } = await mount('Bold', { toggle: '' });
    const events: string[] = [];
    for (const type of ['click', 'input', 'change'])
      el.addEventListener(type, () => events.push(type));
    el.pressed = true;
    await settle(el);
    await tick();
    expect(events).toEqual([]);
  });

  it.runIf(server.browser === 'chromium')('draws the pressed state in forced colours', async () => {
    const session = cdp();
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    });
    try {
      const { el, control } = await mount('Bold', { toggle: '', pressed: '' });
      const probe = document.createElement('span');
      probe.style.color = 'Highlight';
      container.append(probe);
      expect(getComputedStyle(control).backgroundColor).toBe(getComputedStyle(probe).color);
      // A loading toggle stays pressed.
      el.loading = true;
      await settle(el);
      expect(getComputedStyle(control).backgroundColor).toBe(getComputedStyle(probe).color);
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] });
    }
  });
});

// The button in its parent (page 1398:2 and its handoff acceptance B-A1 to B-A8), with the shipped
// theme so sizes and colours are the real token values.
describe('odd-button in its parent', () => {
  let unload: () => void;
  beforeAll(async () => {
    await import('../src/button/button.define.js');
    unload = await loadTheme();
  });
  afterAll(() => unload());
  type Button = HTMLElementTagNameMap['odd-button'];
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const resolveIn = (scope: Element, property: string, variable: string) => {
    const probe = document.createElement('div');
    probe.style.setProperty(property, `var(${variable})`);
    scope.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  };
  const control = (el: Element) => el.shadowRoot!.querySelector<HTMLButtonElement>('button')!;

  it('B-A1: keeps the control, slots, focus, and pressed state while the parent narrows and widens', async () => {
    container.innerHTML = `<div style="display: flex; flex-wrap: wrap; gap: 12px; box-sizing: border-box;
      inline-size: 640px; padding: 16px">
      <odd-button toggle pressed><span slot="start" aria-hidden="true">+</span>Review and publish the accessibility report<span slot="end" aria-hidden="true">&gt;</span></odd-button>
      <odd-button>Cancel</odd-button></div>`;
    const row = container.firstElementChild as HTMLElement;
    const [el, cancel] = [...row.querySelectorAll<Button>('odd-button')] as [Button, Button];
    await settle(el);
    await settle(cancel);
    const native = control(el);
    const start = el.querySelector('[slot="start"]');
    el.focus();
    const heights: number[] = [];
    for (const width of [640, 240, 640]) {
      row.style.inlineSize = `${width}px`;
      await frame();
      expect(control(el), `${width}`).toBe(native);
      expect(el.querySelector('[slot="start"]')).toBe(start);
      expect(el.shadowRoot!.activeElement).toBe(native);
      expect(el.pressed).toBe(true);
      expect(row.scrollWidth, `${width}`).toBeLessThanOrEqual(row.clientWidth + 1);
      expect(native.scrollWidth, `${width}`).toBeLessThanOrEqual(native.clientWidth + 1);
      expect(cancel.getBoundingClientRect().right).toBeLessThanOrEqual(
        row.getBoundingClientRect().right + 0.5,
      );
      heights.push(native.getBoundingClientRect().height);
    }
    // At 240 px the whole label wraps and the control grows instead of widening.
    expect(heights[1]).toBeGreaterThan(heights[0]!);
    expect(heights[2]).toBe(heights[0]);
  });

  it('B-A2: keeps its size, slots, name, and focus while loading; the spinner turns at the centre', async () => {
    for (const size of ['sm', 'md', 'lg']) {
      container.innerHTML = '';
      const { el, control: native } = await mount(
        '<span slot="start" aria-hidden="true">+</span>Save changes<span slot="end" aria-hidden="true">&gt;</span>',
        { appearance: 'primary', size },
      );
      el.focus();
      const before = native.getBoundingClientRect().toJSON();
      let clicks = 0;
      el.addEventListener('click', () => clicks++);
      el.loading = true;
      await settle(el);
      expect(native.getBoundingClientRect().toJSON(), size).toEqual(before);
      const spinner = el.shadowRoot!.querySelector<HTMLElement>('[part="spinner"]')!;
      // Its box turns; its centre stays the control's.
      const ring = spinner.getBoundingClientRect();
      expect(ring.left + ring.width / 2).toBeCloseTo(before.x + before.width / 2, 0);
      expect(ring.top + ring.height / 2).toBeCloseTo(before.y + before.height / 2, 0);
      // Figma's busy icon: 14 px at sm and md, 16 px at lg, 1em of the label.
      expect(spinner.offsetWidth, size).toBe(size === 'lg' ? 16 : 14);
      expect(getComputedStyle(el.shadowRoot!.querySelector('.label')!).opacity).toBe('0');
      for (const slotted of el.querySelectorAll('[slot]'))
        expect(getComputedStyle(slotted).opacity).toBe('0');
      expect(page.getByRole('button', { name: 'Save changes' }).element()).toBe(native);
      expect(el.shadowRoot!.activeElement).toBe(native);
      await userEvent.keyboard('{Enter}');
      el.click();
      expect(clicks).toBe(0);
      el.loading = false;
      await settle(el);
      expect(native.getBoundingClientRect().toJSON(), size).toEqual(before);
      expect(getComputedStyle(el.shadowRoot!.querySelector('.label')!).opacity).toBe('1');
      expect(el.shadowRoot!.activeElement).toBe(native);
    }
  });

  it('B-A3: a pressed toggle keeps the selection colours loading and disabled, in each scope', async () => {
    for (const scope of [
      'data-odd-mode="light"',
      'data-odd-mode="dark"',
      'data-odd-density="compact"',
    ]) {
      container.innerHTML = `<div ${scope}>${['', 'loading', 'disabled']
        .map((state) => `<odd-button toggle pressed ${state}>Bold</odd-button>`)
        .join('')}</div>`;
      const wrapper = container.firstElementChild!;
      const buttons = [...wrapper.querySelectorAll<Button>('odd-button')];
      for (const el of buttons) await settle(el);
      const background = resolveIn(wrapper, 'background-color', '--odd-color-selection-background');
      const foreground = resolveIn(wrapper, 'color', '--odd-color-selection-foreground');
      const height = resolveIn(wrapper, 'min-height', '--odd-control-height-md');
      for (const [i, el] of buttons.entries()) {
        const style = getComputedStyle(control(el));
        const at = `${scope} ${['pressed', 'loading', 'disabled'][i]}`;
        expect(
          [style.backgroundColor, style.borderTopColor, style.color, style.minHeight],
          at,
        ).toEqual([background, background, foreground, height]);
        expect(style.opacity, at).toBe(i === 2 ? '0.5' : '1');
      }
    }
  });

  it('B-A6: an icon-only button keeps its label as its name while loading, at least the target size', async () => {
    const { el, control: native } = await mount(
      '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"></svg>',
      { label: 'Bold', toggle: '' },
    );
    el.loading = true;
    await settle(el);
    expect(page.getByRole('button', { name: 'Bold' }).element()).toBe(native);
    const box = native.getBoundingClientRect();
    const target = parseFloat(resolveIn(container, 'min-height', '--odd-target-min'));
    expect(box.width).toBeGreaterThanOrEqual(target);
    expect(box.height).toBeGreaterThanOrEqual(target);
  });

  it('B-A7: the host’s status and retry, in a bounded parent, keep the draft beside them', async () => {
    container.innerHTML = `<section aria-label="Save status" style="block-size: 176px; overflow-y: auto;
      inline-size: 640px"><p role="status">Could not save. Your changes are retained. ${'Retry is a host action. '.repeat(8)}</p>
      <div style="display: flex; flex-wrap: wrap; gap: 12px"><textarea>Draft text</textarea>
      <odd-button>Try again</odd-button></div></section>`;
    const reader = container.querySelector('section')!;
    const textarea = container.querySelector('textarea')!;
    const retry = container.querySelector<Button>('odd-button')!;
    await settle(retry);
    textarea.focus();
    textarea.setSelectionRange(2, 6);
    for (const width of [640, 240, 640]) {
      reader.style.inlineSize = `${width}px`;
      retry.loading = width === 240;
      await settle(retry);
      await frame();
      expect(container.querySelector('textarea')).toBe(textarea);
      expect([textarea.value, textarea.selectionStart, textarea.selectionEnd]).toEqual([
        'Draft text',
        2,
        6,
      ]);
      expect(document.activeElement).toBe(textarea);
      expect(reader.scrollWidth).toBeLessThanOrEqual(reader.clientWidth + 1);
    }
    retry.focus();
    expect(retry.shadowRoot!.activeElement).toBe(control(retry));
    retry.scrollIntoView({ block: 'nearest' });
    await frame();
    const box = reader.getBoundingClientRect();
    const last = retry.getBoundingClientRect();
    expect(last.bottom).toBeLessThanOrEqual(box.bottom + 0.5);
    expect(last.top).toBeGreaterThanOrEqual(box.top - 0.5);
  });

  it('B-A8: removed with a toggle or a submission queued, it acts on neither and reconnects at baseline', async () => {
    const { el } = await mount('Bold', { toggle: '' });
    const before = scopeStats();
    const events: string[] = [];
    for (const type of ['input', 'change']) el.addEventListener(type, () => events.push(type));
    // The click flips pressed at once and queues input and change for the next task.
    el.click();
    el.remove();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(events).toEqual([]);
    container.append(el);
    await settle(el);
    // The flip is kept; reconnecting dispatches nothing and adds nothing.
    expect(el.pressed).toBe(true);
    expect(events).toEqual([]);
    expect(scopeStats()).toEqual(before);
    const form = document.createElement('form');
    form.innerHTML = '<odd-button type="submit" name="intent" value="save">Save</odd-button>';
    container.append(form);
    const submit = form.querySelector<Button>('odd-button')!;
    await settle(submit);
    let submits = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits++;
    });
    submit.click();
    submit.remove();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(submits).toBe(0);
    form.append(submit);
    await settle(submit);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(submits).toBe(0);
    expect(form.querySelectorAll('button')).toHaveLength(0);
  });

  const icon = (attributes = '') =>
    `<odd-icon ${attributes}><svg viewBox="0 0 20 20"><path d="M4 4l12 12" /></svg></odd-icon>`;
  const px = (scope: Element, variable: string) =>
    parseFloat(resolveIn(scope, 'inline-size', variable));
  const iconOnly = (el: Element) => el.matches(':state(icon-only)');

  it('B-A9: one icon alone is a square at each size and density, never below the target size', async () => {
    await import('../src/icon/icon.define.js');
    for (const density of ['', 'data-odd-density="compact"'])
      for (const size of ['sm', 'md', 'lg']) {
        container.innerHTML = `<div ${density}><odd-button size="${size}" label="Close">${icon()}</odd-button>
          <odd-button size="${size}" label="Close"><svg viewBox="0 0 20 20"></svg></odd-button></div>`;
        const scope = container.firstElementChild!;
        const square = Math.max(
          px(scope, `--odd-control-height-${size}`),
          px(scope, '--odd-target-min'),
        );
        for (const el of scope.querySelectorAll<Button>('odd-button')) {
          await settle(el);
          const box = control(el).getBoundingClientRect();
          expect([box.width, box.height], `${density} ${size}`).toEqual([square, square]);
          expect(iconOnly(el)).toBe(true);
        }
      }
  });

  it('B-A9: the state follows the content on the same node, with focus kept', async () => {
    await import('../src/icon/icon.define.js');
    const { el, control: native } = await mount(icon(), { label: 'Close' });
    el.focus();
    const square = native.getBoundingClientRect().width;
    const text = document.createTextNode(' ');
    el.append(text);
    await settle(el);
    // Whitespace beside the icon keeps it icon-only.
    expect(iconOnly(el)).toBe(true);
    // A template's text binding changes the text node in place.
    text.data = 'Close';
    await expect.poll(() => iconOnly(el)).toBe(false);
    await frame();
    expect(native.getBoundingClientRect().width).toBeGreaterThan(square);
    text.data = '';
    await expect.poll(() => iconOnly(el)).toBe(true);
    el.append(document.createElement('span'));
    await expect.poll(() => iconOnly(el)).toBe(false);
    el.lastElementChild!.remove();
    await expect.poll(() => iconOnly(el)).toBe(true);
    // An icon in the start slot is not the default slot's content.
    el.firstElementChild!.setAttribute('slot', 'start');
    await expect.poll(() => iconOnly(el)).toBe(false);
    el.firstElementChild!.removeAttribute('slot');
    await expect.poll(() => iconOnly(el)).toBe(true);
    await frame();
    expect(native.getBoundingClientRect().width).toBe(square);
    expect(control(el)).toBe(native);
    expect(el.shadowRoot!.activeElement).toBe(native);
  });

  it('B-A10: icons take 16/16/20 px beside text and 20/20/24 px alone; --odd-icon-size overrides', async () => {
    await import('../src/icon/icon.define.js');
    const sizes = { sm: ['sm', 'md'], md: ['sm', 'md'], lg: ['md', 'lg'] };
    for (const [size, [beside, alone]] of Object.entries(sizes)) {
      container.innerHTML = `<odd-button size="${size}">${icon('slot="start"')}Save${icon('slot="end"')}</odd-button>
        <odd-button size="${size}" label="Close">${icon()}</odd-button>
        <odd-button size="${size}" label="Close"><svg viewBox="0 0 20 20"></svg></odd-button>
        <odd-button size="${size}" label="Close">${icon('size="lg" style="--odd-icon-size: 12px"')}</odd-button>`;
      const buttons = [...container.querySelectorAll<Button>('odd-button')];
      for (const el of buttons) await settle(el);
      for (const i of container.querySelectorAll('odd-icon')) await settle(i);
      const edge = (el: Element) => {
        const box = el.getBoundingClientRect();
        expect(box.width, `${size} ${el.outerHTML}`).toBe(box.height);
        return box.width;
      };
      const [text, alone1, alone2, custom] = buttons as [Button, Button, Button, Button];
      const besideSize = px(container, `--odd-icon-size-${beside}`);
      const aloneSize = px(container, `--odd-icon-size-${alone}`);
      expect([...text.querySelectorAll('odd-icon')].map(edge), size).toEqual([
        besideSize,
        besideSize,
      ]);
      expect(edge(alone1.querySelector('odd-icon')!), size).toBe(aloneSize);
      expect(edge(alone2.querySelector('svg')!), size).toBe(aloneSize);
      expect(edge(custom.querySelector('odd-icon')!), size).toBe(12);
      // Every icon fits its control.
      for (const el of buttons)
        for (const i of el.querySelectorAll('odd-icon, svg'))
          expect(edge(i)).toBeLessThanOrEqual(control(el).getBoundingClientRect().height);
    }
  });

  it('B-A11: an icon-only button without label warns once; with label, or with text, never', async () => {
    await import('../src/icon/icon.define.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      container.innerHTML = `<odd-button label="Close">${icon()}</odd-button>
        <odd-button>${icon('label="Close"')}</odd-button>
        <odd-button>${icon('slot="start"')}Close</odd-button>`;
      const [named, unnamed, text] = [...container.querySelectorAll<Button>('odd-button')] as [
        Button,
        Button,
        Button,
      ];
      for (const el of [named, unnamed, text]) await settle(el);
      const codes = () =>
        warn.mock.calls.map(([message]) => /^\[([^\]]+)\]/.exec(String(message))?.[1]);
      // An icon's own label does not name the button.
      expect(codes()).toEqual(['button.label.missing']);
      expect(String(warn.mock.calls[0]![0])).toContain('<odd-button>');
      // Once per element: reconnecting, naming and unnaming it again stay silent.
      unnamed.remove();
      container.append(unnamed);
      await settle(unnamed);
      unnamed.label = 'Close';
      await settle(unnamed);
      unnamed.label = '';
      await settle(unnamed);
      // Losing its text later makes a text button icon-only: it warns then, once.
      text.lastChild!.remove();
      text.firstElementChild!.removeAttribute('slot');
      await expect.poll(() => iconOnly(text)).toBe(true);
      named.label = 'Dismiss';
      await settle(named);
      expect(codes()).toEqual(['button.label.missing', 'button.label.missing']);
    } finally {
      warn.mockRestore();
    }
  });
});
