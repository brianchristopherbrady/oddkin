import { defineExamples } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import type {} from './suggestions.js';

type Choice = CustomEvent<{ readonly suggestionId: string; readonly prompt: string }>;

export default defineExamples('odd-suggestions', {
  default: {
    label: 'Suggested prompts',
    props: {
      suggestions: [
        { id: 'summarize', label: 'Summarize', prompt: 'Summarize this page in three bullets.' },
        { id: 'risks', label: 'List risks', prompt: 'What are the main risks in this plan?' },
      ],
    },
    recommended: true,
    guidance:
      'Choosing a suggestion sends `odd-suggestion-select`, and the host puts its prompt in its own message field; the send button beside it sends `odd-suggestion-submit`, and the host sends the prompt at once. They are separate intents.',
    // The host: a message field that takes a chosen prompt, and a line that says what was sent.
    fixture({ scope, element, mount }) {
      const field = mount(
        html`<odd-textarea label="Message" rows="2" resize="auto"></odd-textarea>`,
      ) as HTMLElement & { value: string };
      const sent = mount(html`<p></p>`);
      scope.listen(element, 'odd-suggestion-select', (event) => {
        field.value = (event as Choice).detail.prompt;
      });
      scope.listen(element, 'odd-suggestion-submit', (event) => {
        sent.textContent = `Sent: ${(event as Choice).detail.prompt}`;
      });
    },
  },
});
