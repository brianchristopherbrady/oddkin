import { defineExamples } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import type {} from './message-branch.js';

// Three answers to one prompt, in the order they were generated.
const answers = [
  { id: 'm2a', text: 'Use a media query on the page.' },
  { id: 'm2', text: 'Use a container query on the card.' },
  { id: 'm2c', text: 'Use a grid with auto-fit columns.' },
];

type Branch = HTMLElement & {
  messageId: string;
  branch: { index: number; count: number; previousId?: string; nextId?: string };
};

export default defineExamples('odd-message-branch', {
  default: {
    label: 'Second of three answers',
    props: {
      messageId: 'm2',
      branch: { index: 2, count: 3, previousId: 'm2a', nextId: 'm2c' },
      capabilities: { switchBranch: { available: true } },
    },
    recommended: true,
    guidance:
      'The arrows only ask (`odd-branch-switch` names the answer to show); the host shows it and passes back the new position. Here the host keeps three answers and shows the current one after the control.',
    fixture({ scope, element, mount }) {
      const control = element as Branch;
      const answer = mount(html`<p></p>`);
      const show = (id: string) => {
        const at = answers.findIndex((a) => a.id === id);
        control.messageId = id;
        control.branch = {
          index: at + 1,
          count: answers.length,
          ...(at > 0 ? { previousId: answers[at - 1]!.id } : {}),
          ...(at < answers.length - 1 ? { nextId: answers[at + 1]!.id } : {}),
        };
        answer.textContent = answers[at]!.text;
      };
      scope.listen(element, 'odd-branch-switch', (event) => {
        show((event as CustomEvent<{ readonly targetMessageId: string }>).detail.targetMessageId);
      });
      show('m2');
    },
  },
});
