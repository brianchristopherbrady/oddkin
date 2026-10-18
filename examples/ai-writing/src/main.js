// Inline writing assistant demo: selection capture, assistance requests, proposals bound to the
// revision they were made for, review with accept/reject/undo, stale handling, provenance, and
// dictation. Simulated: proposals and explanations come from deterministic local functions.
import '@oddkin/ai/define/inline-assist';
import '@oddkin/ai/define/change-review';
import '@oddkin/ai/define/voice-input';
import '@oddkin/ai/define/ai-label';
import { createAnnouncer } from '@oddkin/ai/announce';
import {
  DocumentSession,
  captureSelection,
  createScriptedVoiceAdapter,
} from '@oddkin/ai/controllers';

const $ = (selector) => document.querySelector(selector);
const editor = $('#editor');
const assist = $('odd-inline-assist');
const review = $('odd-change-review');
const voice = $('odd-voice-input');
const label = $('odd-ai-label');
createAnnouncer($('#app'));

const doc = new DocumentSession(
  'Our team is very excited to share the quarterly update. Sales grew in every region and the new onboarding flow reduced support tickets.',
  { revisionPrefix: 'doc' },
);
let assisted = 0;
let delay = Number($('#delay').value);
let proposalCount = 0;

const refresh = () => {
  const state = doc.getSnapshot();
  if (editor.value !== state.text) editor.value = state.text;
  review.proposals = state.proposals;
  assist.documentRevision = state.revision;
  label.hidden = assisted === 0;
  label.provenance = {
    kind: 'assisted',
    notes: `${assisted} suggestion(s) applied in this session (simulated).`,
  };
};

const capture = () => {
  assist.selection = captureSelection(editor, doc.getSnapshot().revision);
};
editor.addEventListener('input', () => {
  doc.setText(editor.value);
  refresh();
});
for (const type of ['select', 'keyup', 'pointerup']) editor.addEventListener(type, capture);

const DICTIONARY = {
  our: 'notre',
  team: 'équipe',
  sales: 'ventes',
  grew: 'ont augmenté',
  in: 'dans',
  every: 'chaque',
  region: 'région',
  the: 'le',
  update: 'mise à jour',
};
const transform = {
  rewrite: (text) =>
    text
      .replace(/\bvery\s+/gi, '')
      .replace(/\s+/g, ' ')
      .trim(),
  expand: (text) => `${text.replace(/\.$/, '')}, which we explain with a concrete example below.`,
  translate: (text) =>
    text
      .split(/(\s+)/)
      .map((w) => DICTIONARY[w.toLowerCase()] ?? w)
      .join(''),
};

assist.addEventListener('assist-request', (event) => {
  const { action, selection } = event.detail;
  assist.status = 'pending';
  assist.pendingAction = action;
  assist.result = '';
  setTimeout(() => {
    assist.status = 'ready';
    if (action in transform) {
      const record = doc.propose({
        proposalId: `p${++proposalCount}`,
        baseRevision: selection.revision,
        range: { start: selection.start, end: selection.end },
        original: selection.text,
        replacement: transform[action](selection.text),
        label: `${action[0].toUpperCase()}${action.slice(1)} (simulated)`,
      });
      assist.result = record.status === 'stale' ? '' : 'A proposal is ready for review.';
    } else if (action === 'explain') {
      assist.result = `**Explanation (simulated).** “${selection.text.slice(0, 60)}” is a status sentence: it states a result and its effect.`;
    } else {
      assist.result = `**Summary (simulated):** ${selection.text.split(/\s+/).slice(0, 10).join(' ')}…`;
    }
    refresh();
  }, delay);
});

review.addEventListener('change-accept', (event) => {
  if (doc.accept(event.detail.proposalId).ok) assisted++;
  refresh();
});
review.addEventListener('change-reject', (event) => {
  doc.reject(event.detail.proposalId);
  refresh();
});
review.addEventListener('change-undo', (event) => {
  if (doc.undo(event.detail.proposalId).ok) assisted = Math.max(0, assisted - 1);
  refresh();
});

// Dictation through a scripted (simulated) adapter.
const voiceAdapter = (deny) =>
  createScriptedVoiceAdapter(
    [
      { after: 300, interim: 'Next quarter' },
      { after: 300, interim: 'Next quarter we plan' },
      { after: 400, final: 'Next quarter we plan to expand to two new markets.' },
    ],
    { denyPermission: deny, permissionDelay: 200 },
  );
voice.adapter = voiceAdapter(false);
voice.addEventListener('voice-transcript', (event) => {
  doc.setText(`${doc.getSnapshot().text} ${event.detail.text}`);
  refresh();
});

$('#delay').addEventListener('change', (event) => (delay = Number(event.target.value)));
$('#edit-now').addEventListener('click', () => {
  doc.setText(`${doc.getSnapshot().text} (edited while waiting)`);
  refresh();
});
$('#deny').addEventListener(
  'change',
  (event) => (voice.adapter = voiceAdapter(event.target.checked)),
);

refresh();
document.body.dataset.ready = 'true';
