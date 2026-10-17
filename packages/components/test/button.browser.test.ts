import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@mote/core/reactive';
import { scopeStats } from '@mote/core/scope';

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
    expect(foundation.MoteButton).toBe(entry.MoteButton);
    expect(Object.keys(foundation).sort()).toEqual([
      'MoteButton',
      'buttonStructuralStyles',
      'buttonTemplate',
    ]);
    expect(customElements.get('mote-button')).toBeUndefined();
    await import('../src/button/button.define.js');
    expect(customElements.get('mote-button')).toBe(entry.MoteButton);
  });
});

async function mount(markup = 'Save', attributes: Record<string, string> = {}) {
  await import('../src/button/button.define.js');
  const el = document.createElement('mote-button');
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  el.innerHTML = markup;
  container.append(el);
  await settle(el);
  const control = el.shadowRoot!.querySelector('button')!;
  return { el, control };
}

describe('mote-button', () => {
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
    expect(el.shadowRoot!.adoptedStyleSheets).toHaveLength(2);
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
    const el = f.querySelector('mote-button')!;
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
      '<mote-button type="submit" name="intent" value="save">Save</mote-button>',
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
  });

  it('runs constraint validation before submitting', async () => {
    const { el, submits } = await form(
      '<mote-button type="submit">Save</mote-button>',
      '<input name="q" required />',
    );
    await userEvent.click(el);
    await nextTask();
    expect(submits).toHaveLength(0);
  });

  it('does not submit when the click is cancelled or the type is button', async () => {
    const { el, submits } = await form('<mote-button type="submit">Save</mote-button>');
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
    const { f, el } = await form('<mote-button type="reset">Reset</mote-button>');
    const input = f.querySelector('input')!;
    input.value = 'changed';
    await userEvent.click(el);
    await nextTask();
    expect(input.value).toBe('initial');
  });

  it('follows a disabled fieldset', async () => {
    const { f, el, submits } = await form(
      '<fieldset disabled><mote-button type="submit">Save</mote-button></fieldset>',
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
    container.style.setProperty('--mote-button-radius', '0px');
    // The default (secondary) appearance reads color.surface.default.
    container.style.setProperty('--mote-color-surface-default', 'rgb(1, 2, 3)');
    await settle(el);
    expect(el.shadowRoot!.querySelector('button')).toBe(control);
    expect(getComputedStyle(control).borderTopLeftRadius).toBe('0px');
    expect(getComputedStyle(control).backgroundColor).toBe('rgb(1, 2, 3)');
  });
});
