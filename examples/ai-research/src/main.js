// Research assistant demo: composer, context, streaming Markdown with citations, tools, sources,
// artifacts, usage, history, stop/disconnect/resume, and isolation. Simulated; no network.
import '@oddkin/components/define/button';
import '@oddkin/components/define/chip';
import '@oddkin/ai/define/conversation';
import '@oddkin/ai/define/prompt-input';
import '@oddkin/ai/define/context-picker';
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
} from './fixtures.js';

const $ = (selector) => document.querySelector(selector);
const app = $('#app');
const conversation = $('odd-conversation');
const composer = $('odd-prompt-input');
const picker = $('odd-context-picker');
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

conversation.store = controller;
conversation.markdown = { highlight, linkTarget: '_blank' };
conversation.feedbackReasons = ['Inaccurate', 'Missing sources', 'Too long'];
composer.controller = draft;
// Suggested prompts (@oddkin/ai/patterns/suggested-prompts): a suggestion fills the composer and
// focuses it; the person sends it.
for (const button of document.querySelectorAll('[data-prompt]'))
  button.addEventListener('click', () => {
    composer.value = button.dataset.prompt;
    composer.focus();
  });
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
  composer.loading = !!attempt && isActive(attempt.status);
  composer.attemptId = attempt?.attemptId ?? '';
  composer.capabilities = state.capabilities;
  if (attempt?.usage) usage.usage = attempt.usage;
  $('#state').textContent = attempt
    ? `attempt ${attempt.status} · connection ${attempt.connection} · stop ${attempt.stop}`
    : 'idle';
};
controller.subscribe(sync);
sync();

// Context is application-owned: the host answers the picker's searches from its connected sources,
// lets each change apply, and shows the chosen resources as removable chips.
const contextSources = [
  { id: 'notes', label: 'Notes' },
  { id: 'papers', label: 'Papers', description: '2 collections', browse: true },
  { id: 'web', label: 'Saved pages' },
];
// What a paper collection holds, by its id (a source's top level by the source's id).
const collections = {
  papers: [
    {
      sourceId: 'papers',
      id: 'coral',
      label: 'Coral',
      type: 'collection',
      description: 'Open collection',
      container: true,
    },
    {
      sourceId: 'papers',
      id: 'seas',
      label: 'Temperate seas',
      type: 'collection',
      description: 'Open collection',
      container: true,
    },
  ],
  coral: [
    {
      sourceId: 'papers',
      id: 'reef-survey',
      label: 'Reef survey 2024',
      type: 'paper',
      description: 'PDF · 12 pages',
    },
  ],
  seas: [
    {
      sourceId: 'papers',
      id: 'kelp-loss',
      label: 'Kelp forest loss',
      type: 'paper',
      description: 'PDF · 8 pages',
    },
  ],
};
const library = [
  {
    sourceId: 'notes',
    id: 'heatwaves',
    label: 'Marine heatwaves',
    type: 'note',
    path: 'Ocean',
    description: 'Selected text',
  },
  {
    sourceId: 'papers',
    id: 'reef-survey',
    label: 'Reef survey 2024',
    type: 'paper',
    path: 'Coral',
    description: 'PDF · 12 pages',
  },
  {
    sourceId: 'papers',
    id: 'kelp-loss',
    label: 'Kelp forest loss',
    type: 'paper',
    path: 'Temperate seas',
    description: 'PDF · 8 pages',
  },
  {
    sourceId: 'web',
    id: 'noaa',
    label: 'NOAA coral bleaching watch',
    type: 'page',
    path: 'noaa.gov',
    description: 'Saved yesterday',
  },
];
picker.sources = contextSources;
picker.multiple = true;
const chosen = $('#chosen-context');
const showChosen = (value = picker.value) => {
  chosen.replaceChildren(
    ...value.map((resource) => {
      const chip = document.createElement('odd-chip');
      chip.removable = true;
      chip.textContent = resource.label;
      chip.addEventListener('odd-chip-remove', () => {
        picker.value = picker.value.filter((r) => r !== resource);
        showChosen();
      });
      return chip;
    }),
  );
};
picker.addEventListener('odd-context-query', ({ detail }) => {
  const query = detail.query.toLocaleLowerCase();
  setTimeout(() => {
    if (detail.signal.aborted) return;
    picker.results = {
      requestId: detail.requestId,
      items: detail.location
        ? (collections[detail.location.id ?? detail.location.sourceId] ?? [])
        : library.filter(
            (r) =>
              detail.sourceIds.includes(r.sourceId) && r.label.toLocaleLowerCase().includes(query),
          ),
      sources: detail.sourceIds.map((sourceId) => ({ sourceId, status: 'complete' })),
    };
  }, 250);
});
picker.addEventListener('odd-context-change', ({ detail }) => {
  showChosen(detail.value);
  note(`context: ${detail.reason} (${detail.value.length} chosen)`);
});
picker.value = library.slice(0, 1);
showChosen();
modelSelect.addEventListener('odd-model-change', (event) => note(`model: ${event.detail.modelId}`));

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
