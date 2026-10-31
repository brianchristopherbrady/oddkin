// Answers stream from this page's own server (./api/chat) through @oddkin/ai's adapter for the
// AI SDK UI message stream protocol. server.mjs replays canned answers; README.md shows the route
// to put in its place for a real model.
import '@oddkin/ai/define/conversation';
import '@oddkin/ai/define/prompt-input';
import {
  ComposerController,
  ConversationController,
  bindIntents,
  controllerIntents,
  isActive,
} from '@oddkin/ai/controllers';
import { createUiMessageStreamTransport } from '@oddkin/ai/stream';

const conversation = document.querySelector('odd-conversation');
const composer = document.querySelector('odd-prompt-input');
const status = document.querySelector('#chat-status');

const endpoint = (path) => new URL(path, document.baseURI).href;
const transport = createUiMessageStreamTransport({
  api: endpoint('./api/chat'),
  stopApi: () => endpoint('./api/stop'),
  onDiagnostic: (diagnostic) => console.warn(`${diagnostic.code}: ${diagnostic.message}`),
});
const controller = new ConversationController({
  transport,
  conversationId: crypto.randomUUID(),
});
const draft = new ComposerController({ attachments: false });
conversation.store = controller;
composer.controller = draft;

bindIntents(
  document.querySelector('#app'),
  controllerIntents(controller, draft, {
    onResult: (intent, result) => {
      if (!result.ok) status.textContent = `${intent}: ${result.reason}`;
    },
  }),
);

const sync = () => {
  const state = controller.getSnapshot();
  const attempt = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
  composer.loading = !!attempt && isActive(attempt.status);
  composer.attemptId = attempt?.attemptId ?? '';
  composer.capabilities = state.capabilities;
};
controller.subscribe(sync);
sync();
