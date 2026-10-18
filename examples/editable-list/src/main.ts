import '@oddkin/components/define/button';
import '@oddkin/components/define/input';
import type { OddkinButton } from '@oddkin/components/button';
import { createTeamEditor, TeamModel, type Member } from './team.js';

const form = document.querySelector<HTMLFormElement>('#team')!;
const list = document.querySelector<HTMLOListElement>('#members')!;
const status = document.querySelector<HTMLElement>('#status')!;
const undo = document.querySelector<OddkinButton>('#undo')!;
const result = document.querySelector<HTMLElement>('#result')!;

const initial: Member[] = [
  { id: 'ada', name: 'Ada Lovelace', email: 'ada@example.com' },
  { id: 'grace', name: 'Grace Hopper', email: 'grace@example.com' },
  { id: 'katherine', name: 'Katherine Johnson', email: 'katherine@example.com' },
];

// Stands in for a server: addresses at taken.example belong to another team.
const checkEmail = (email: string, signal: AbortSignal) =>
  new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        resolve(
          /@taken\.example$/i.test(email) ? 'This address already belongs to another team.' : '',
        ),
      400,
    );
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

const announce = (message: string) => (status.textContent = message);

const editor = createTeamEditor(list, initial, {
  checkEmail,
  announce,
  onRemove() {
    undo.hidden = false;
    void undo.updateComplete.then(() => undo.focus());
  },
});

document.querySelector('#add')!.addEventListener('click', () => editor.focus(editor.add()));
undo.addEventListener('click', () => {
  undo.hidden = true;
  const id = editor.undo();
  if (id) editor.focus(id);
});

// Runs only when native validation passed: required fields and email syntax.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const names = data.getAll('member-name');
  const emails = data.getAll('member-email');
  const team = data.getAll('member-id').map((id, index) => ({
    id: String(id),
    name: String(names[index] ?? ''),
    email: String(emails[index] ?? ''),
  }));
  const checked = TeamModel.validate(team);
  if (!checked.ok) {
    const unplaced = editor.showDiagnostics(checked.diagnostics);
    const count = checked.diagnostics.length;
    announce(
      [`Not saved: ${count} ${count === 1 ? 'problem' : 'problems'}.`]
        .concat(unplaced.map((d) => d.message))
        .join(' '),
    );
    return;
  }
  result.textContent = JSON.stringify(team, null, 2);
  announce(`Saved ${team.length} ${team.length === 1 ? 'member' : 'members'}.`);
});

document.body.dataset['ready'] = 'true';
