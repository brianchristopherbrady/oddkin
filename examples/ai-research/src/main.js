// Research assistant demo: composer, context, streaming Markdown with citations, tools, sources,
// artifacts, usage, history, stop/disconnect/resume, and isolation. Simulated; no network.
import '@oddkin/ai/define/conversation';
import '@oddkin/ai/define/prompt-input';
import '@oddkin/ai/define/context-picker';
import '@oddkin/ai/define/suggestions';
import '@oddkin/ai/define/model-select';
import '@oddkin/ai/define/usage-meter';
import {
  ComposerController,
  ConversationController,
  bindIntents,
  controllerIntents,
  isActive,
} from '@oddkin/ai/controllers';
import { highlight } from '@oddkin/ai/highlight';
import { createSimulatedTransport } from '@oddkin/ai/stream';
import {
  historyPages,
  initialConversation,
  models,
  otherConversation,
  researchScript,
  suggestions,
} from './fixtures.js';

const $ = (selector) => document.querySelector(selector);
const app = $('#app');
const conversation = $('odd-conversation');
const composer = $('odd-prompt-input');
const picker = $('odd-context-picker');
const suggestionList = $('odd-suggestions');
const modelSelect = $('odd-model-select');
const usage = $('odd-usage-meter');
const log = $('#log');

let speed = Number($('#speed').value);
const transport = createSimulatedTransport({
  script: (request) => researchScript(request, speed),
  history: historyPages,
  controls: { acceptDelay: 150, stopDelay: 400 },
});
const controller = new ConversationController({ transport, conversationId: 'research-1' });
controller.load(initialConversation);
const draft = new ComposerController({
  accept: ['image/*', '.pdf', '.txt', '.md'],
  maxFileSize: 2 * 1024 * 1024,
  maxFiles: 4,
});

conversation.source = controller;
conversation.markdown = { highlight, linkTarget: '_blank' };
conversation.feedbackReasons = ['Inaccurate', 'Missing sources', 'Too long'];
composer.controller = draft;
suggestionList.suggestions = suggestions;
modelSelect.models = models;
modelSelect.value = 'sim-deep';

const note = (text) => {
  const item = document.createElement('li');
  item.textContent = `${new Date().toLocaleTimeString()} — ${text}`;
  log.prepend(item);
  while (log.children.length > 12) log.lastElementChild.remove();
};

bindIntents(
  app,
  controllerIntents(controller, draft, {
    onResult: (intent, result) => {
      if (!result.ok)
        note(`${intent}: ${result.reason}${result.error ? ` (${result.error.message})` : ''}`);
    },
  }),
);

// The composer and status follow the authoritative conversation state.
const sync = () => {
  const state = controller.getSnapshot();
  const attempt = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
  composer.busy = !!attempt && isActive(attempt.status);
  composer.attemptId = attempt?.attemptId ?? '';
  composer.capabilities = state.capabilities;
  if (attempt?.usage) usage.usage = attempt.usage;
  $('#state').textContent = attempt
    ? `attempt ${attempt.status} · connection ${attempt.connection} · stop ${attempt.stop}`
    : 'idle';
};
controller.subscribe(sync);
sync();

// Context is application-owned: requests become records with simulated upload progress.
let items = [];
const setItems = (next) => {
  items = next;
  picker.items = items;
};
const progress = (id, steps) => {
  if (!steps.length) return;
  const [status, ...rest] = steps;
  setTimeout(() => {
    if (!items.some((i) => i.id === id)) return;
    setItems(items.map((i) => (i.id === id ? { ...i, status } : i)));
    progress(id, rest);
  }, 400);
};
let contextId = 0;
picker.addEventListener('context-add', (event) => {
  const detail = event.detail;
  const added =
    detail.kind === 'url'
      ? [
          {
            id: `ctx-${++contextId}`,
            kind: 'url',
            label: detail.url,
            url: detail.url,
            status: 'selected',
            preview: 'Fetched page text appears here (simulated).',
          },
        ]
      : detail.files.map((file) => ({
          id: `ctx-${++contextId}`,
          kind: 'file',
          label: file.name,
          size: file.size,
          mediaType: file.type,
          status: 'selected',
        }));
  setItems([...items, ...added]);
  for (const item of added) progress(item.id, ['uploading', 'processing', 'ready']);
});
picker.addEventListener('context-remove', (event) =>
  setItems(items.filter((i) => i.id !== event.detail.itemId)),
);
setItems([
  {
    id: 'ctx-0',
    kind: 'selection',
    label: 'Selected text from notes',
    status: 'ready',
    preview: 'Marine heatwaves: prolonged periods of unusually warm sea temperatures.',
  },
]);

modelSelect.addEventListener('model-change', (event) => note(`model: ${event.detail.modelId}`));

// Simulation controls.
$('#speed').addEventListener('change', (event) => (speed = Number(event.target.value)));
$('#fail-send').addEventListener('change', (event) => {
  transport.controls.failNextSend = event.target.checked
    ? {
        code: 'sim.rejected',
        message: 'The service rejected the request (simulated).',
        retryable: true,
      }
    : undefined;
});
$('#stop-behavior').addEventListener(
  'change',
  (event) => (transport.controls.stopBehavior = event.target.value),
);
$('#stop-delay').addEventListener(
  'change',
  (event) => (transport.controls.stopDelay = Number(event.target.value)),
);
$('#disconnect').addEventListener('click', () =>
  note(`disconnect: ${controller.disconnect().ok ? 'ok' : 'nothing to disconnect'}`),
);
$('#resume').addEventListener(
  'click',
  () => void controller.resume().then((r) => note(`resume: ${r.ok ? 'ok' : r.reason}`)),
);
let previousAttempt;
$('#switch').addEventListener('click', () => {
  const state = controller.getSnapshot();
  previousAttempt = state.activeAttemptId;
  controller.load(state.conversationId === 'research-1' ? otherConversation : initialConversation);
  note(`switched to ${controller.getSnapshot().conversationId}`);
});
$('#late').addEventListener('click', () => {
  if (!previousAttempt) return note('switch conversations first');
  transport.inject(previousAttempt, {
    type: 'text-delta',
    partId: 'late',
    delta: 'LATE EVENT FROM A PREVIOUS CONVERSATION',
  });
  note('injected a late event for the previous conversation (it is ignored)');
});

document.body.dataset.ready = 'true';
