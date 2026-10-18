import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LiveAnnouncer, createLiveRegion, createLiveRegions } from '../src/controllers/announce.js';
import { FocusRecovery, RovingFocus } from '../src/controllers/focus.js';
import { FormValue } from '../src/controllers/form.js';
import { IntersectionController, ResizeController } from '../src/controllers/observe.js';
import { flush, signal } from '../src/reactive/index.js';
import { createScope, scopeStats, type Scope } from '../src/scope/index.js';

let container: HTMLElement;
let scope: Scope;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  scope = createScope({ name: 'test' });
});
afterEach(() => {
  scope.dispose();
  flush();
  container.remove();
});

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
const key = (target: Element, name: string) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true }),
  );
const active = () => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
};

describe('RovingFocus', () => {
  const toolbar = (markup: string) => {
    container.innerHTML = `<div role="toolbar">${markup}</div>`;
    const bar = container.firstElementChild as HTMLElement;
    const items = () => [...bar.querySelectorAll('button')];
    return { bar, items };
  };

  it('keeps one Tab stop and moves with arrows, Home, and End, wrapping and skipping disabled items', () => {
    const { bar, items } = toolbar(
      '<button>A</button><button disabled>B</button><button>C</button><button>D</button>',
    );
    const roving = scope.use(new RovingFocus({ target: () => bar, items }));
    expect(items().map((b) => b.tabIndex)).toEqual([0, -1, -1, -1]);
    items()[0]!.focus();
    key(active() as Element, 'ArrowRight');
    expect(active()?.textContent).toBe('C');
    expect(items().map((b) => b.tabIndex)).toEqual([-1, -1, 0, -1]);
    key(active() as Element, 'End');
    expect(active()?.textContent).toBe('D');
    key(active() as Element, 'ArrowRight');
    expect(active()?.textContent).toBe('A');
    key(active() as Element, 'ArrowLeft');
    expect(active()?.textContent).toBe('D');
    key(active() as Element, 'Home');
    expect(active()?.textContent).toBe('A');
    expect(roving.activeIndex).toBe(0);
    // Vertical arrows do nothing in a horizontal toolbar.
    expect(key(active() as Element, 'ArrowDown')).toBe(true);
    expect(active()?.textContent).toBe('A');
  });

  it('mirrors horizontal arrows in right-to-left text and can stop at the ends', () => {
    const { bar, items } = toolbar('<button>A</button><button>B</button>');
    bar.dir = 'rtl';
    scope.use(new RovingFocus({ target: () => bar, items, wrap: false }));
    items()[0]!.focus();
    key(active() as Element, 'ArrowLeft');
    expect(active()?.textContent).toBe('B');
    key(active() as Element, 'ArrowLeft');
    expect(active()?.textContent).toBe('B');
    key(active() as Element, 'ArrowRight');
    expect(active()?.textContent).toBe('A');
  });

  it('follows focus that arrives by pointer, reports changes instead of writing tabindex, and stops on dispose', () => {
    const { bar, items } = toolbar('<button>A</button><button>B</button><button>C</button>');
    const changes: number[] = [];
    const own = scope.child();
    own.use(
      new RovingFocus({
        target: () => bar,
        items,
        orientation: 'vertical',
        onActiveChange: (index) => changes.push(index),
      }),
    );
    expect(items().every((b) => !b.hasAttribute('tabindex'))).toBe(true);
    items()[2]!.focus();
    expect(changes).toEqual([0, 2]);
    key(active() as Element, 'ArrowUp');
    expect(changes).toEqual([0, 2, 1]);
    own.dispose();
    expect(key(active() as Element, 'ArrowUp')).toBe(true);
    expect(changes).toEqual([0, 2, 1]);
  });

  it('moves the Tab stop when the active item is removed', () => {
    const { bar, items } = toolbar('<button>A</button><button>B</button>');
    const roving = scope.use(new RovingFocus({ target: () => bar, items }));
    roving.setActive(1);
    items()[1]!.remove();
    roving.sync();
    expect(items()[0]!.tabIndex).toBe(0);
    expect(roving.activeIndex).toBe(0);
  });
});

describe('FocusRecovery', () => {
  const host = () => {
    const el = document.createElement('div');
    const root = el.attachShadow({ mode: 'open' });
    root.innerHTML = '<p class="status">Done</p><button class="a">A</button><button>B</button>';
    container.append(el);
    const status = root.querySelector('.status') as HTMLElement;
    const button = root.querySelector('.a') as HTMLButtonElement;
    scope.use(new FocusRecovery({ root: () => root, fallback: () => status }));
    return { root, status, button };
  };

  for (const [name, change] of [
    ['removed', (b: HTMLButtonElement) => b.remove()],
    ['hidden', (b: HTMLButtonElement) => (b.hidden = true)],
    ['disabled', (b: HTMLButtonElement) => (b.disabled = true)],
  ] as const) {
    it(`moves focus to the fallback when the focused control is ${name}`, async () => {
      const { status, button } = host();
      button.focus();
      expect(active()).toBe(button);
      change(button);
      await tick();
      expect(active()).toBe(status);
      expect(status.tabIndex).toBe(-1);
    });
  }

  it('never moves focus the user took elsewhere', async () => {
    const { button } = host();
    const outside = document.createElement('button');
    container.append(outside);
    button.focus();
    outside.focus();
    button.remove();
    await tick();
    expect(active()).toBe(outside);
  });

  it('keeps the native focusability of a focusable fallback', async () => {
    const el = document.createElement('div');
    const root = el.attachShadow({ mode: 'open' });
    root.innerHTML = '<button class="a">A</button><button class="fallback">Next</button>';
    container.append(el);
    const fallback = root.querySelector('.fallback') as HTMLButtonElement;
    scope.use(new FocusRecovery({ root: () => root, fallback: () => fallback }));
    const button = root.querySelector('.a') as HTMLButtonElement;
    button.focus();
    button.remove();
    await tick();
    expect(active()).toBe(fallback);
    expect(fallback.hasAttribute('tabindex')).toBe(false);
  });
});

describe('LiveAnnouncer', () => {
  it('creates a polite and an assertive region, announces each key once, and joins close messages', async () => {
    const regions = createLiveRegions(container);
    const announcer = scope.use(new LiveAnnouncer({ regions: () => regions, delay: 10 }));
    const [polite, assertive] = [...container.children] as HTMLElement[];
    expect(polite?.getAttribute('aria-live')).toBe('polite');
    expect(polite?.getAttribute('role')).toBe('status');
    expect(assertive?.getAttribute('aria-live')).toBe('assertive');
    expect(polite?.textContent).toBe('');
    announcer.announce({ text: 'Saved.', key: 'save-1' });
    announcer.announce({ text: 'Saved.', key: 'save-1' });
    announcer.announce({ text: '2 new messages.' });
    announcer.announce({ text: 'Upload failed.', priority: 'assertive' });
    await tick(30);
    expect(polite?.textContent).toBe('Saved. 2 new messages.');
    expect(assertive?.textContent).toBe('Upload failed.');
    announcer.announce({ text: 'Saved.', key: 'save-1' });
    await tick(30);
    expect(polite?.textContent).toBe('Saved. 2 new messages.');
    announcer.reset();
    announcer.announce({ text: 'Saved.', key: 'save-1' });
    await tick(30);
    expect(polite?.textContent).toBe('Saved.');
  });

  it('routes a caller-named event to the nearest announcer only, and cleans up on dispose', async () => {
    const outerRegions = createLiveRegions(container);
    scope.use(
      new LiveAnnouncer({
        regions: () => outerRegions,
        event: 'app-announce',
        target: () => container,
        delay: 5,
      }),
    );
    const inner = document.createElement('section');
    container.append(inner);
    const own = scope.child();
    const innerRegions = createLiveRegions(inner);
    own.add(() => innerRegions.remove());
    own.use(
      new LiveAnnouncer({
        regions: () => innerRegions,
        event: 'app-announce',
        target: () => inner,
        delay: 5,
      }),
    );
    const source = document.createElement('span');
    inner.append(source);
    const event = new CustomEvent('app-announce', {
      detail: { text: 'Copied.' },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    source.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await tick(20);
    const regions = (el: Element) =>
      [...el.children].filter((c) => c.hasAttribute('aria-live')).map((c) => c.textContent);
    expect(regions(inner)).toEqual(['Copied.', '']);
    expect(regions(container)).toEqual(['', '']);
    own.dispose();
    expect(regions(inner)).toEqual([]);
    const late = new CustomEvent('app-announce', {
      detail: { text: 'Later.' },
      bubbles: true,
      cancelable: true,
    });
    source.dispatchEvent(late);
    await tick(20);
    expect(regions(container)).toEqual(['Later.', '']);
  });

  it('uses existing regions and writes nothing after disconnect', async () => {
    const polite = createLiveRegion(document, 'polite');
    const assertive = createLiveRegion(document, 'assertive');
    container.append(polite, assertive);
    const own = scope.child();
    const announcer = own.use(new LiveAnnouncer({ regions: () => ({ polite, assertive }) }));
    announcer.announce({ text: 'Queued.' });
    own.dispose();
    await tick(150);
    expect(polite.textContent).toBe('');
    expect(polite.isConnected).toBe(true);
  });
});

describe('observers', () => {
  it('ResizeController delivers the latest entry per target and disconnects with its scope', async () => {
    const box = document.createElement('div');
    box.style.width = '100px';
    container.append(box);
    const calls: number[][] = [];
    const own = scope.child();
    own.use(
      new ResizeController((entries) => calls.push(entries.map((e) => e.contentRect.width)), {
        targets: () => [box],
      }),
    );
    await frame();
    await frame();
    expect(calls).toEqual([[100]]);
    box.style.width = '150px';
    await frame();
    await frame();
    expect(calls.at(-1)).toEqual([150]);
    const count = calls.length;
    own.dispose();
    box.style.width = '50px';
    await frame();
    await frame();
    expect(calls.length).toBe(count);
  });

  it("'frame' timing merges deliveries for several targets into one call", async () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    container.append(a, b);
    const calls: number[] = [];
    const controller = scope.use(
      new ResizeController((entries) => calls.push(entries.length), {
        targets: () => [a],
        timing: 'frame',
      }),
    );
    controller.observe(b);
    await frame();
    await frame();
    await frame();
    expect(calls).toEqual([2]);
  });

  it('IntersectionController reports visibility with options read on connect', async () => {
    const target = document.createElement('div');
    target.style.height = '10px';
    container.append(target);
    const seen: boolean[] = [];
    scope.use(
      new IntersectionController((entries) => seen.push(entries[0]!.isIntersecting), {
        targets: () => [target],
        init: () => ({ threshold: 0 }),
      }),
    );
    await expect.poll(() => seen).toEqual([true]);
  });

  it('owns nothing after dispose', () => {
    const baseline = scopeStats().scopes;
    const own = scope.child();
    own.use(new ResizeController(() => {}, { targets: () => [container] }));
    own.dispose();
    expect(scopeStats().scopes).toBe(baseline);
  });
});

describe('FormValue', () => {
  class TestField extends HTMLElement {
    static formAssociated = true;
    readonly internals = this.attachInternals();
    readonly value = signal('');
    readonly error = signal('');
    readonly required = signal(false);
    readonly input = document.createElement('input');
    resets = 0;
    restored: unknown = undefined;
    readonly form = new FormValue({
      internals: () => this.internals,
      value: () => this.value.value,
      control: () => this.input,
      error: () => this.error.value,
      watch: () => this.required.value,
      onReset: () => {
        this.resets++;
        this.value.value = '';
      },
      onRestore: (state) => (this.restored = state),
    });
    #scope: Scope | undefined;
    constructor() {
      super();
      this.attachShadow({ mode: 'open' }).append(this.input);
    }
    connectedCallback() {
      this.#scope = createScope();
      this.#scope.use(this.form);
    }
    disconnectedCallback() {
      this.#scope?.dispose();
    }
    formDisabledCallback(disabled: boolean) {
      this.form.formDisabledCallback(disabled);
    }
    formResetCallback() {
      this.form.formResetCallback();
    }
    formStateRestoreCallback(state: string, mode: 'restore' | 'autocomplete') {
      this.form.formStateRestoreCallback(state, mode);
    }
  }
  if (!customElements.get('test-form-field')) customElements.define('test-form-field', TestField);

  const mount = () => {
    container.innerHTML =
      '<form><fieldset><test-form-field name="email"></test-form-field></fieldset></form>';
    flush();
    const form = container.querySelector('form') as HTMLFormElement;
    const field = container.querySelector('test-form-field') as TestField;
    return { form, field, fieldset: container.querySelector('fieldset') as HTMLFieldSetElement };
  };

  it('submits the value and mirrors the inner control’s validity, with a custom error first', () => {
    const { form, field } = mount();
    field.value.value = 'ada@example.com';
    flush();
    expect(new FormData(form).get('email')).toBe('ada@example.com');
    expect(field.form.invalid.value).toBe(false);
    field.input.required = true;
    field.input.value = '';
    field.value.value = '';
    field.required.value = true;
    flush();
    expect(field.internals.validity.valueMissing).toBe(true);
    expect(field.internals.validationMessage).toBe(field.input.validationMessage);
    expect(form.checkValidity()).toBe(false);
    field.error.value = 'Already taken.';
    flush();
    expect(field.internals.validity.customError).toBe(true);
    expect(field.internals.validationMessage).toBe('Already taken.');
    field.error.value = '';
    field.input.required = false;
    field.required.value = false;
    flush();
    expect(field.form.invalid.value).toBe(false);
  });

  it('forwards reset, restore, and fieldset disabled state', () => {
    const { form, field, fieldset } = mount();
    field.value.value = 'x';
    flush();
    form.reset();
    expect(field.resets).toBe(1);
    flush();
    expect(new FormData(form).get('email')).toBe('');
    fieldset.disabled = true;
    expect(field.form.disabled.value).toBe(true);
    fieldset.disabled = false;
    expect(field.form.disabled.value).toBe(false);
    field.formStateRestoreCallback('saved', 'restore');
    expect(field.restored).toBe('saved');
  });
});
