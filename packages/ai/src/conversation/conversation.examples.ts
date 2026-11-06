import { defineExamples, type ExampleFixtureContext } from '@oddkin/workbench/examples';
import {
  ConversationController,
  bindIntents,
  controllerIntents,
  isActive,
} from '@oddkin/ai/controllers';
import { createSimulatedTransport, streamTextSteps } from '@oddkin/ai/stream';
import type { ConversationSnapshot } from '../contracts/types.js';
import type { OddkinPromptInput } from '../prompt-input/prompt-input.js';
import type { OddkinConversation } from './conversation.js';

// The latest exchange. The one before it is still on the server, until Load earlier messages.
const latest: ConversationSnapshot['messages'] = [
  {
    id: 'm1',
    role: 'user',
    parentId: 'm0b',
    parts: [{ type: 'text', id: 't1', text: 'Summarize the release notes.' }],
  },
  {
    id: 'm2',
    role: 'assistant',
    parentId: 'm1',
    parts: [
      {
        type: 'text',
        id: 't2',
        text: 'Builds are faster and the side navigation gained project kinds.',
      },
    ],
  },
];
const earlier: ConversationSnapshot = {
  conversationId: 'c1',
  messages: [
    {
      id: 'm0a',
      role: 'user',
      parts: [{ type: 'text', id: 't0a', text: 'What shipped this week?' }],
    },
    {
      id: 'm0b',
      role: 'assistant',
      parentId: 'm0a',
      parts: [{ type: 'text', id: 't0b', text: 'Version 2.4, with its release notes.' }],
    },
  ],
};

/**
 * The host both examples share: a conversation controller is the store, a simulated transport
 * answers each message with the same streamed text, and the composer in the `composer` slot
 * follows the controller (busy while an answer streams). A sent message leaves the composer
 * once the controller has taken it.
 */
function host(
  { scope, element }: ExampleFixtureContext<OddkinConversation>,
  composer: OddkinPromptInput,
  conversation: ConversationSnapshot,
  history: readonly ConversationSnapshot[] = [],
): void {
  let answers = 0;
  const transport = createSimulatedTransport({
    script: () => [
      ...streamTextSteps(
        `answer-${++answers}`,
        'A simulated answer, streamed in small pieces like a real one.',
        40,
      ),
      { after: 0, event: { type: 'finish' } },
    ],
    history,
    // This host sends text only.
    capabilities: { attachments: { available: false } },
  });
  const controller = new ConversationController({
    transport,
    conversationId: conversation.conversationId,
  });
  controller.load(conversation);
  composer.slot = 'composer';
  element.append(composer);
  element.store = controller;
  const follow = () => {
    const state = controller.getSnapshot();
    const attempt = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
    composer.loading = !!attempt && isActive(attempt.status);
    composer.attemptId = attempt?.attemptId ?? '';
    composer.capabilities = state.capabilities;
  };
  follow();
  scope.add(controller.subscribe(follow));
  scope.add(
    bindIntents(element, {
      ...controllerIntents(controller),
      'odd-prompt-submit': ({ text, submissionId }) =>
        void controller.send({ text }).then((result) => {
          if (result.ok) composer.acknowledge(submissionId);
          else
            composer.fail(
              submissionId,
              result.error ?? {
                code: `ai.send.${result.reason}`,
                message: 'The message could not be sent.',
              },
            );
        }),
    }),
  );
  scope.add(() => {
    composer.remove();
    controller.dispose();
    transport.dispose();
  });
}

export default defineExamples('odd-conversation', {
  default: {
    label: 'Conversation',
    props: {
      label: 'Assistant',
      state: {
        conversationId: 'c1',
        revision: 1,
        messages: latest,
        tools: {},
        approvals: {},
        artifacts: {},
        attempts: {},
        branches: {},
        capabilities: { send: { available: true }, history: { available: true } },
        history: 'idle',
        hasMoreHistory: true,
        feedback: {},
      },
    },
    slots: { status: 'Connected to the assistant' },
    recommended: true,
    guidance:
      'Give it a store (or a state snapshot); it never fetches or sends by itself. Here the store is a `ConversationController` on a simulated transport: the composer in the `composer` slot sends to it, each answer streams in, and Load earlier messages brings back the exchange before.',
    fixture: (context) =>
      host(
        context,
        document.createElement('odd-prompt-input'),
        { conversationId: 'c1', messages: latest, hasMoreHistory: true },
        [earlier],
      ),
  },
  empty: {
    label: 'Empty',
    props: {
      label: 'Assistant',
      state: {
        conversationId: 'c2',
        revision: 1,
        messages: [],
        tools: {},
        approvals: {},
        artifacts: {},
        attempts: {},
        branches: {},
        capabilities: {},
        history: 'complete',
        hasMoreHistory: false,
        feedback: {},
      },
    },
    slots: { empty: 'Ask a question to start.' },
    fixture: (context) =>
      host(context, document.createElement('odd-prompt-input'), {
        conversationId: 'c2',
        messages: [],
      }),
  },
});
