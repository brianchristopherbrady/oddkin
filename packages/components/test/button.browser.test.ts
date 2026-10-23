import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';

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
      'hostStyles',
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
