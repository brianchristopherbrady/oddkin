import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FormValue } from '../src/controllers/form.js';
import { OddkinError } from '../src/diagnostics/index.js';
import { effect, flush, signal } from '../src/reactive/index.js';
import { createScope, scopeStats, type Scope } from '../src/scope/index.js';

// Contract: core-contracts.md §4.1 (`FormValue`) and the HTML form-associated custom element
// callbacks. The form owner follows insertion, moves, the `form` attribute, and the form that
// attribute names; only the owner submits, validates, resets, and disables the element.
class AssociatedField extends HTMLElement {
  static formAssociated = true;
  readonly internals = this.attachInternals();
  readonly value = signal('ada@example.com');
  readonly input = document.createElement('input');
  connections = 0;
  resets = 0;
  readonly controller = new FormValue({
    internals: () => this.internals,
    value: () => this.value.value,
    control: () => this.input,
    onReset: () => {
      this.resets++;
      this.value.value = '';
    },
  });
  #scope: Scope | undefined;
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).append(this.input);
  }
  connectedCallback() {
    this.connections++;
    this.#scope = createScope({ name: 'associated-field' });
    this.#scope.use(this.controller);
  }
  disconnectedCallback() {
    this.#scope?.dispose();
    this.#scope = undefined;
  }
  // Opts in to state-preserving moves (`moveBefore`), which keep the connection.
  connectedMoveCallback() {}
  formAssociatedCallback(form: HTMLFormElement | null) {
    this.controller.formAssociatedCallback(form);
  }
  formDisabledCallback(disabled: boolean) {
    this.controller.formDisabledCallback(disabled);
  }
  formResetCallback() {
    this.controller.formResetCallback();
  }
}
if (!customElements.get('test-associated-field'))
  customElements.define('test-associated-field', AssociatedField);

let root: HTMLElement;
beforeEach(() => {
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  root.remove();
  flush();
});

function forms(markup: string) {
  root.innerHTML = markup;
  const byId = (id: string) => root.querySelector<HTMLFormElement>(`form#${id}`)!;
  return byId;
}
function field(name = 'email') {
  const el = document.createElement('test-associated-field') as AssociatedField;
  el.setAttribute('name', name);
  return el;
}
/** Owner ids seen by a tracked reader of `controller.form`, one entry per change. */
function owners(el: AssociatedField) {
  const seen: (string | null)[] = [];
  const stop = effect(() => {
    seen.push(el.controller.form.value?.id ?? null);
  });
  return { seen, stop };
}
const entries = (form: HTMLFormElement) => [...new FormData(form)];
const step = (run: () => void) => {
  run();
  flush();
};

describe('FormValue form owner', () => {
  it('follows insertion, moves between forms, and removal; only the owner submits the value', () => {
    const form = forms('<form id="a"></form><form id="b"></form>');
    const el = field();
    const { seen, stop } = owners(el);
    step(() => form('a').append(el));
    expect(el.controller.form.value).toBe(form('a'));
    expect(entries(form('a'))).toEqual([['email', 'ada@example.com']]);
    step(() => form('b').append(el));
    expect(entries(form('a'))).toEqual([]);
    expect(entries(form('b'))).toEqual([['email', 'ada@example.com']]);
    // The value effect belongs to the new connection.
    step(() => (el.value.value = 'grace@example.com'));
    expect(entries(form('b'))).toEqual([['email', 'grace@example.com']]);
    step(() => el.remove());
    expect(el.controller.form.value).toBe(null);
    expect(entries(form('b'))).toEqual([]);
    expect(seen).toEqual([null, 'a', 'b', null]);
    expect(el.connections).toBe(2);
    stop();
  });

  it('follows the form attribute and the form it names as that form appears, leaves, or is renamed', () => {
    const form = forms('<form id="a"></form><form id="b"></form>');
    const el = field();
    step(() => form('a').append(el));
    const { seen, stop } = owners(el);
    step(() => el.setAttribute('form', 'b'));
    expect(entries(form('a'))).toEqual([]);
    expect(entries(form('b'))).toEqual([['email', 'ada@example.com']]);
    step(() => el.removeAttribute('form'));
    expect(el.controller.form.value).toBe(form('a'));
    step(() => el.setAttribute('form', 'later'));
    expect(el.controller.form.value).toBe(null);
    const later = document.createElement('form');
    later.id = 'later';
    step(() => root.append(later));
    expect(el.controller.form.value).toBe(later);
    expect(entries(later)).toEqual([['email', 'ada@example.com']]);
    step(() => later.remove());
    expect(el.controller.form.value).toBe(null);
    step(() => root.append(later));
    step(() => (later.id = 'renamed'));
    expect(el.controller.form.value).toBe(null);
    expect(entries(later)).toEqual([]);
    expect(seen).toEqual(['a', 'b', 'a', null, 'later', null, 'later', null]);
    stop();
  });

  it.skipIf(!('moveBefore' in Element.prototype))(
    'keeps its connection and value effect through a state-preserving move to another form',
    () => {
      const form = forms('<form id="a"></form><form id="b"></form>');
      const el = field();
      step(() => form('a').append(el));
      const before = scopeStats();
      step(() =>
        (form('b') as unknown as { moveBefore(node: Node, child: Node | null): void }).moveBefore(
          el,
          null,
        ),
      );
      expect(el.connections).toBe(1);
      expect(scopeStats()).toEqual(before);
      expect(el.controller.form.value).toBe(form('b'));
      step(() => (el.value.value = 'lin@example.com'));
      expect(entries(form('a'))).toEqual([]);
      expect(entries(form('b'))).toEqual([['email', 'lin@example.com']]);
    },
  );

  it('is disabled and left out inside a disabled fieldset, and enabled again when moved out', () => {
    const form = forms('<form id="a"><fieldset disabled></fieldset></form><form id="b"></form>');
    const el = field();
    step(() => root.querySelector('fieldset')!.append(el));
    expect(el.controller.disabled.value).toBe(true);
    expect(el.controller.form.value).toBe(form('a'));
    expect(entries(form('a'))).toEqual([]);
    step(() => form('b').append(el));
    expect(el.controller.disabled.value).toBe(false);
    expect(entries(form('b'))).toEqual([['email', 'ada@example.com']]);
  });

  it('is in the submission entry list of its owner, which alone validates and resets it', async () => {
    // Submissions navigate a named frame, so the test page stays put.
    const form = forms(
      '<iframe name="sink"></iframe>' +
        '<form id="a" action="about:blank" target="sink"></form>' +
        '<form id="b" action="about:blank" target="sink"></form>',
    );
    const el = field();
    el.input.required = true;
    el.value.value = '';
    step(() => form('a').append(el));
    expect(form('a').checkValidity()).toBe(false);
    step(() => form('b').append(el));
    expect(form('a').checkValidity()).toBe(true);
    expect(form('b').checkValidity()).toBe(false);
    expect(el.internals.validity.valueMissing).toBe(true);

    el.input.value = 'ada@example.com';
    step(() => (el.value.value = 'ada@example.com'));
    expect(form('b').checkValidity()).toBe(true);
    const submitted: [string, FormDataEntryValue][][] = [];
    for (const id of ['a', 'b'])
      form(id).addEventListener('formdata', (event) => submitted.push([...event.formData]));
    form('a').requestSubmit();
    form('b').requestSubmit();
    expect(submitted).toEqual([[], [['email', 'ada@example.com']]]);

    form('a').reset();
    expect(el.resets).toBe(0);
    form('b').reset();
    expect(el.resets).toBe(1);
    flush();
    expect(entries(form('b'))).toEqual([['email', '']]);
  });

  it('reports controller.form.notAssociated for an element that did not opt in', () => {
    class Plain extends HTMLElement {
      readonly internals = this.attachInternals();
    }
    if (!customElements.get('test-plain-field')) customElements.define('test-plain-field', Plain);
    const el = document.createElement('test-plain-field') as Plain;
    root.append(el);
    const scope = createScope();
    const before = scopeStats().effects;
    let error: unknown;
    try {
      scope.use(new FormValue({ internals: () => el.internals, value: () => 'x' }));
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(OddkinError);
    expect((error as OddkinError).code).toBe('controller.form.notAssociated');
    expect((error as OddkinError).message).toContain('static formAssociated = true');
    expect(scopeStats().effects).toBe(before);
    scope.dispose();
  });
});

// A control drawn without a native one (a listbox): a detached `<select>` supplies the browser's
// flags and message, and `anchor` is the focusable part they point to.
class MirroredField extends HTMLElement {
  static formAssociated = true;
  readonly internals = this.attachInternals();
  readonly selected = signal('');
  readonly mirror = document.createElement('select');
  readonly target = document.createElement('div');
  readonly controller = new FormValue({
    internals: () => this.internals,
    value: () => this.selected.value || null,
    control: () => {
      const value = this.selected.value;
      this.mirror.required = true;
      this.mirror.replaceChildren(...(value ? [new Option(value, value, true, true)] : []));
      return this.mirror;
    },
    anchor: () => this.target,
  });
  #scope: Scope | undefined;
  constructor() {
    super();
    this.target.tabIndex = 0;
    this.attachShadow({ mode: 'open' }).append(this.target);
  }
  connectedCallback() {
    this.#scope = createScope({ name: 'mirrored-field' });
    this.#scope.use(this.controller);
  }
  disconnectedCallback() {
    this.#scope?.dispose();
  }
}
if (!customElements.get('test-mirrored-field'))
  customElements.define('test-mirrored-field', MirroredField);

describe('FormValue anchor', () => {
  it('takes the flags and message of a detached control and points them at the anchor', () => {
    const form = forms('<form id="a"></form>')('a');
    const el = document.createElement('test-mirrored-field') as MirroredField;
    el.setAttribute('name', 'role');
    step(() => form.append(el));
    expect(el.internals.validity.valueMissing).toBe(true);
    expect(el.internals.validationMessage).toBe(el.mirror.validationMessage);
    expect(el.internals.validationMessage).not.toBe('');
    expect(form.checkValidity()).toBe(false);
    // A blocked submission focuses the anchor in the shadow root.
    form.reportValidity();
    expect(el.shadowRoot!.activeElement).toBe(el.target);
    step(() => (el.selected.value = 'editor'));
    expect(el.internals.validity.valid).toBe(true);
    expect(entries(form)).toEqual([['role', 'editor']]);
  });
});
