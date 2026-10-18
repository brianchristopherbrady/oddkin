import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@oddkin/components/define/button';
import '@oddkin/components/define/input';
import type { OddkinInput } from '@oddkin/components/input';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import {
  TeamModel,
  createTeamEditor,
  type Member,
  type TeamEditor,
  type TeamEditorOptions,
} from '../../examples/editable-list/src/team.js';

// examples/editable-list: keyed odd-input rows in a form (data-composition.md §10, editable
// collection). Runs the example's source against the built packages.

const MEMBERS: readonly Member[] = [
  { id: 'ada', name: 'Ada Lovelace', email: 'ada@example.com' },
  { id: 'grace', name: 'Grace Hopper', email: 'grace@example.com' },
  { id: 'katherine', name: 'Katherine Johnson', email: 'katherine@example.com' },
];

let form: HTMLFormElement;
let editor: TeamEditor | undefined;
beforeEach(() => {
  form = document.createElement('form');
  form.innerHTML = '<ol></ol>';
  document.body.append(form);
});
afterEach(() => {
  editor?.dispose();
  editor = undefined;
  form.remove();
  flush();
});

const settle = async () => {
  flush();
  await Promise.all(
    [...form.querySelectorAll<OddkinInput>('odd-input, odd-button')].map((el) => el.updateComplete),
  );
  flush();
};

async function mount(options: TeamEditorOptions = {}, members = MEMBERS) {
  editor = createTeamEditor(form.querySelector('ol')!, members, options);
  await settle();
  return editor;
}

const row = (id: string) => form.querySelector<HTMLLIElement>(`li[data-key="${id}"]`)!;
const field = (id: string, name: 'name' | 'email') =>
  row(id).querySelector<OddkinInput>(`odd-input[name="member-${name}"]`)!;
const control = (id: string, name: 'name' | 'email') =>
  field(id, name).shadowRoot!.querySelector('input')!;
const legends = () => [...form.querySelectorAll('legend')].map((l) => l.textContent?.trim());
const submitted = () => {
  const data = new FormData(form);
  const names = data.getAll('member-name');
  const emails = data.getAll('member-email');
  return data.getAll('member-id').map((id, i) => [id, names[i], emails[i]]);
};

describe('editable list', () => {
  it('renders one keyed fieldset per member and submits in display order', async () => {
    await mount();
    expect(legends()).toEqual(['Member 1', 'Member 2', 'Member 3']);
    expect(submitted()).toEqual([
      ['ada', 'Ada Lovelace', 'ada@example.com'],
      ['grace', 'Grace Hopper', 'grace@example.com'],
      ['katherine', 'Katherine Johnson', 'katherine@example.com'],
    ]);
    const up = row('ada').querySelector('odd-button')!;
    expect(up.disabled).toBe(true);
    expect(row('katherine').querySelectorAll('odd-button')[1]!.disabled).toBe(true);
  });

  it('keeps typed text, caret, and focus through inserts, removals, and moves', async () => {
    await mount();
    const input = control('grace', 'name');
    await userEvent.click(input);
    await userEvent.keyboard('{End} B.');
    input.setSelectionRange(5, 5);
    const host = field('grace', 'name');
    const check = (label: string) => {
      expect(field('grace', 'name'), label).toBe(host);
      expect(host.shadowRoot!.activeElement, label).toBe(input);
      expect(input.value, label).toBe('Grace Hopper B.');
      expect([input.selectionStart, input.selectionEnd], label).toEqual([5, 5]);
    };
    editor!.add();
    await settle();
    check('after an insert');
    editor!.remove('ada');
    await settle();
    check('after a removal above');
    editor!.move('katherine', -1);
    await settle();
    check('after another row moved past it');
    editor!.move('grace', 1);
    await settle();
    expect(row('grace').nextElementSibling).toBeNull();
    check('after its own row moved');
    expect(legends()).toEqual(['Member 1', 'Member 2', 'Member 3']);
    expect(submitted().map(([id, name]) => [id, name])).toEqual([
      ['katherine', 'Katherine Johnson'],
      [expect.stringMatching(/^new-/), ''],
      ['grace', 'Grace Hopper B.'],
    ]);
  });

  it('moves focus to the other move button when a row reaches an edge', async () => {
    await mount();
    const [up, down] = row('grace').querySelectorAll('odd-button');
    up!.focus();
    up!.click();
    await settle();
    expect(row('grace').previousElementSibling).toBeNull();
    expect(up!.disabled).toBe(true);
    expect(document.activeElement).toBe(down);
  });

  it('maps model diagnostics to the right row and field, and clears them on input', async () => {
    await mount();
    editor!.move('katherine', -2);
    control('ada', 'email').value = 'GRACE@example.com ';
    control('ada', 'email').dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await settle();
    const checked = TeamModel.validate(editor!.values());
    expect(checked.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['team.email.duplicate', '/2/email'],
    ]);
    expect(editor!.showDiagnostics(checked.diagnostics)).toEqual([]);
    await settle();
    expect(field('grace', 'email').error).toBe('Member 2 already uses this address.');
    expect(field('grace', 'email').validity.customError).toBe(true);
    expect(field('ada', 'email').error).toBe('');
    expect(form.checkValidity()).toBe(false);
    await userEvent.type(control('grace', 'email'), 'x');
    await settle();
    expect(field('grace', 'email').error).toBe('');

    const blank = TeamModel.validate([{ id: 'a', name: '  ', email: 'a@example.com' }]);
    expect(blank.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['model.label.empty', '/0/name'],
    ]);
    const unplaced = TeamModel.validate([
      { id: 'a', name: 'A', email: 'a@example.com' },
      { id: 'a', name: 'B', email: 'b@example.com' },
    ]);
    expect(editor!.showDiagnostics(unplaced.diagnostics).map((d) => d.code)).toEqual([
      'model.id.duplicate',
    ]);
  });

  it('aborts a pending address check with its row and restores the row with a new scope', async () => {
    const checks: Array<{ email: string; signal: AbortSignal; resolve: (m: string) => void }> = [];
    const checkEmail = (email: string, signal: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        checks.push({ email, signal, resolve });
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    await mount({ checkEmail, checkDelay: 0 });
    const baseline = scopeStats();
    await userEvent.type(control('grace', 'email'), '{End}.uk');
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Each keystroke supersedes (aborts) the previous check.
    const pending = checks.at(-1)!;
    expect(pending.email).toBe('grace@example.com.uk');
    expect(checks.slice(0, -1).every((c) => c.signal.aborted)).toBe(true);
    expect(pending.signal.aborted).toBe(false);
    expect(scopeStats().scopes).toBeGreaterThan(baseline.scopes);

    editor!.remove('grace');
    await settle();
    expect(pending.signal.aborted).toBe(true);
    expect(row('grace')).toBeNull();

    expect(editor!.undo()).toBe('grace');
    await settle();
    expect(legends()).toEqual(['Member 1', 'Member 2', 'Member 3']);
    expect(field('grace', 'email').value).toBe('grace@example.com.uk');
    // A late answer for the removed row never reaches the restored one.
    pending.resolve('Taken.');
    await settle();
    expect(field('grace', 'email').error).toBe('');
    expect(scopeStats()).toEqual(baseline);
    expect(editor!.undo()).toBeUndefined();
  });

  it('returns to its ownership baseline after 200 add, remove, and undo cycles and on dispose', async () => {
    const before = scopeStats();
    await mount({ checkEmail: async () => '', checkDelay: 0 });
    const baseline = scopeStats();
    for (let i = 0; i < 200; i++) {
      const id = editor!.add();
      editor!.remove(id);
      editor!.undo();
      editor!.remove(id);
    }
    await settle();
    expect(legends()).toHaveLength(3);
    expect(scopeStats()).toEqual(baseline);
    editor!.dispose();
    editor = undefined;
    expect(scopeStats()).toEqual(before);
  });
});
