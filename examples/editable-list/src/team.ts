import type { OddkinButton } from '@oddkin/components/button';
import type { OddkinInput } from '@oddkin/components/input';
import { collection, type Entry, type Key } from '@oddkin/core/collections';
import { ref } from '@oddkin/core/helpers/ref';
import {
  defineModel,
  m,
  type Infer,
  type ModelDiagnostic,
  type ModelRule,
} from '@oddkin/core/model';
import { computed, flush, signal, type Signal } from '@oddkin/core/reactive';
import { createScope, type Release, type Scope } from '@oddkin/core/scope';
import { html, render, repeat } from '@oddkin/core/template';

/** Addresses are compared without case or surrounding spaces. */
const uniqueEmails: ModelRule = Object.freeze({
  kind: 'example.uniqueEmails',
  description: 'Every member has a different email address.',
  check(value: unknown, report: (path: string, code: string, message: string) => void) {
    if (!Array.isArray(value)) return;
    const seen = new Map<string, number>();
    value.forEach((member: unknown, index) => {
      const email = (member as { email?: unknown } | null)?.email;
      if (typeof email !== 'string' || !email.trim()) return;
      const key = email.trim().toLowerCase();
      const first = seen.get(key);
      if (first === undefined) seen.set(key, index);
      else
        report(
          `/${index}/email`,
          'team.email.duplicate',
          `Member ${first + 1} already uses this address.`,
        );
    });
  },
});

/** The team as submitted: members in display order. */
export const TeamModel = defineModel('example.team', {
  version: 1,
  description: 'Members of a team in display order.',
  schema: m.array(
    m.object({
      id: m.id(),
      name: m.label('Full name.'),
      email: m.string({ maxLength: 254 }),
    }),
    { maxItems: 50 },
  ),
  rules: [m.uniqueIds('id'), uniqueEmails],
});

export type Team = Infer<typeof TeamModel>;
export type Member = Team[number];
export type Field = 'name' | 'email';

const MESSAGES: Readonly<Record<string, string>> = {
  'model.label.empty': 'Enter a name.',
};

export interface TeamEditorOptions {
  /** Checks an address with the server; resolves to an error message, or `''` when it is free. */
  readonly checkEmail?: (email: string, signal: AbortSignal) => Promise<string>;
  /** Quiet time after typing before the address is checked, in milliseconds. */
  readonly checkDelay?: number;
  /** Receives short messages for a polite live region. */
  readonly announce?: (message: string) => void;
  /** Called after the user removed a row with its Remove button. */
  readonly onRemove?: (member: Member) => void;
}

export interface TeamEditor {
  /** Append an empty row; returns its id. */
  add(): string;
  remove(id: string): void;
  /** Move a row by `by` places (negative is up). */
  move(id: string, by: number): void;
  /** Restore the last removed row with the values it had; returns its id. */
  undo(): string | undefined;
  /** Current field values in display order. */
  values(): Member[];
  /** Show model diagnostics on their rows and fields; returns those that belong to no field. */
  showDiagnostics(diagnostics: readonly ModelDiagnostic[]): readonly ModelDiagnostic[];
  focus(id: string, field?: Field): void;
  dispose(): void;
}

interface Row {
  readonly scope: Scope;
  readonly errors: Signal<Readonly<Partial<Record<Field, string>>>>;
  name?: OddkinInput | undefined;
  email?: OddkinInput | undefined;
  up?: OddkinButton | undefined;
  down?: OddkinButton | undefined;
  debounce?: Release | undefined;
  check?: Scope | undefined;
}

/**
 * Render an editable, reorderable list of team members into `list` (an `<ol>` inside a form).
 * Rows are keyed by id, so typing, caret, and focus survive inserts, removals, and moves; each
 * row owns a scope for its pending address check, which ends when the row is removed.
 */
export function createTeamEditor(
  list: HTMLElement,
  initial: readonly Member[],
  options: TeamEditorOptions = {},
): TeamEditor {
  const owner = createScope({ name: 'team editor' });
  const team = collection<Member>({ key: (member) => member.id, owner });
  team.set(initial);
  const rows = new Map<Key, Row>();
  let removed: { member: Member; index: number } | undefined;
  let created = 0;

  const rowFor = (key: Key): Row => {
    team.scopeFor(key, (scope) => {
      const row: Row = { scope, errors: signal({}) };
      rows.set(key, row);
      scope.add(() => {
        if (rows.get(key) === row) rows.delete(key);
      }, 'row state');
    });
    return rows.get(key)!;
  };

  const setError = (row: Row, field: Field, message: string) => {
    const { [field]: _previous, ...rest } = row.errors.peek();
    row.errors.value = message ? { ...rest, [field]: message } : rest;
  };

  const onEmailInput = (row: Row) => {
    setError(row, 'email', '');
    row.debounce?.();
    row.check?.dispose();
    const { checkEmail } = options;
    if (!checkEmail) return;
    row.debounce = row.scope.timeout(() => {
      const input = row.email;
      if (!input?.value || !input.validity.valid) return;
      const check = (row.check = row.scope.child({ name: 'email check' }));
      checkEmail(input.value, check.signal).then(
        (message) => {
          if (check.disposed) return;
          check.dispose();
          setError(row, 'email', message);
        },
        () => check.dispose(),
      );
    }, options.checkDelay ?? 300);
  };

  const current = (member: Member): Member => {
    const row = rows.get(member.id);
    return {
      id: member.id,
      name: row?.name?.value ?? member.name,
      email: row?.email?.value ?? member.email,
    };
  };
  const nameOf = (member: Member, index: number) =>
    current(member).name.trim() || `Member ${index + 1}`;

  const commit = (members: readonly Member[]) => {
    team.set(members);
    flush();
  };

  const add = () => {
    const members = team.items.peek();
    let id: string;
    do id = `new-${++created}`;
    while (members.some((member) => member.id === id));
    commit([...members, { id, name: '', email: '' }]);
    options.announce?.(`Added member ${members.length + 1}.`);
    return id;
  };

  const remove = (id: string) => {
    const members = team.items.peek();
    const index = members.findIndex((member) => member.id === id);
    if (index < 0) return;
    const member = current(members[index]!);
    commit(members.filter((other) => other.id !== id));
    removed = { member, index };
    options.announce?.(`Removed ${member.name.trim() || `member ${index + 1}`}.`);
  };

  const move = (id: string, by: number) => {
    const members = team.items.peek();
    const from = members.findIndex((member) => member.id === id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= members.length) return;
    // The pressed button is disabled at the new edge; keep focus inside the row instead.
    const row = rows.get(id);
    if (to === 0 && row?.up?.matches(':focus-within')) row.down?.focus();
    if (to === members.length - 1 && row?.down?.matches(':focus-within')) row.up?.focus();
    const next = [...members];
    const [member] = next.splice(from, 1);
    next.splice(to, 0, member!);
    commit(next);
    options.announce?.(`${nameOf(member!, from)} moved to position ${to + 1} of ${next.length}.`);
  };

  const undo = () => {
    const last = removed;
    removed = undefined;
    const members = team.items.peek();
    if (!last || members.some((member) => member.id === last.member.id)) return undefined;
    const next = [...members];
    next.splice(Math.min(last.index, next.length), 0, last.member);
    commit(next);
    options.announce?.(`Restored ${last.member.name.trim() || `member ${last.index + 1}`}.`);
    return last.member.id;
  };

  const focus = (id: string, field: Field = 'name') => {
    const input = rows.get(id)?.[field];
    if (input) void input.updateComplete.then(() => input.focus());
  };

  const showDiagnostics = (diagnostics: readonly ModelDiagnostic[]) => {
    const entries = team.flat.peek();
    const unplaced: ModelDiagnostic[] = [];
    let first: [string, Field] | undefined;
    for (const diagnostic of diagnostics) {
      const match = /^\/(\d+)\/(name|email)$/.exec(diagnostic.path);
      const entry = match ? entries[Number(match[1])] : undefined;
      const row = entry && rows.get(entry.key);
      if (!match || !entry || !row) {
        unplaced.push(diagnostic);
        continue;
      }
      const field = match[2] as Field;
      setError(row, field, MESSAGES[diagnostic.code] ?? diagnostic.message);
      first ??= [String(entry.key), field];
    }
    if (first) focus(...first);
    return unplaced;
  };

  const view = ({ key, item, index }: Entry<Member>) => {
    const row = rowFor(key);
    const id = String(key);
    const last = computed(() => index === team.flat.value.length - 1);
    return html`<li class="member" data-key=${id}>
      <fieldset class="odd-stack">
        <legend>Member ${index + 1}</legend>
        <input type="hidden" name="member-id" value=${id} />
        <div class="odd-auto-grid fields">
          <odd-input
            ref=${ref<OddkinInput>((el) => (row.name = el))}
            label="Name"
            name="member-name"
            autocomplete="off"
            required
            value=${item.name}
            .error=${computed(() => row.errors.value.name ?? '')}
            @input=${() => setError(row, 'name', '')}
          ></odd-input>
          <odd-input
            ref=${ref<OddkinInput>((el) => (row.email = el))}
            label="Email"
            type="email"
            name="member-email"
            autocomplete="off"
            required
            value=${item.email}
            .error=${computed(() => row.errors.value.email ?? '')}
            @input=${() => onEmailInput(row)}
          ></odd-input>
        </div>
        <div class="odd-cluster">
          <odd-button
            ref=${ref<OddkinButton>((el) => (row.up = el))}
            size="sm"
            ?disabled=${index === 0}
            @click=${() => move(id, -1)}
            >Move up</odd-button
          >
          <odd-button
            ref=${ref<OddkinButton>((el) => (row.down = el))}
            size="sm"
            ?disabled=${last}
            @click=${() => move(id, 1)}
            >Move down</odd-button
          >
          <odd-button
            size="sm"
            appearance="ghost"
            @click=${() => {
              const member = current(item);
              remove(id);
              options.onRemove?.(member);
            }}
            >Remove</odd-button
          >
        </div>
      </fieldset>
    </li>`;
  };

  const part = render(
    repeat(team.flat, (entry) => entry.key, view),
    list,
  );

  return {
    add,
    remove,
    move,
    undo,
    values: () => team.items.peek().map(current),
    showDiagnostics,
    focus,
    dispose() {
      part.dispose();
      owner.dispose();
    },
  };
}
