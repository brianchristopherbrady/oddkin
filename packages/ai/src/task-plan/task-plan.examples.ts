import { defineExamples } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import type { PlanStep } from '../contracts/types.js';
import type {} from '../question/question.js';
import type {} from './task-plan.js';

export default defineExamples('odd-task-plan', {
  default: {
    label: 'Plan in progress',
    props: {
      plan: {
        planId: 'p1',
        title: 'Prepare the release',
        steps: [
          { id: 'a', title: 'Collect changes', status: 'done' },
          {
            id: 'b',
            title: 'Run checks',
            status: 'active',
            tasks: [
              { id: 'b1', title: 'Unit tests', status: 'done' },
              { id: 'b2', title: 'Browser tests', status: 'active' },
            ],
          },
          {
            id: 'c',
            title: 'Choose a version',
            status: 'needs-input',
            inputRequest: 'Major or minor?',
          },
          { id: 'd', title: 'Publish', status: 'blocked', blocker: 'Waiting for the version.' },
        ],
      },
    },
    recommended: true,
    guidance:
      'Respond asks the host for a way to answer the step. Here the host asks the question with an `odd-question`; the answer completes the step, and the step that waited for it is no longer blocked.',
    // The host: asks the step's question with an odd-question, then records the answer on the plan.
    fixture({ scope, element, mount }) {
      const ask = (step: PlanStep) => {
        const question = mount(
          html`<odd-question tabindex="-1"></odd-question>`,
        ) as HTMLElementTagNameMap['odd-question'];
        question.question = {
          questionId: step.id,
          revision: 1,
          prompt: step.inputRequest ?? step.title,
          kind: 'choice',
          options: [
            { id: 'major', label: 'Major' },
            { id: 'minor', label: 'Minor' },
          ],
          status: 'requested',
        };
        scope.listen<GlobalEventHandlersEventMap['odd-question-answer']>(
          question,
          'odd-question-answer',
          ({ detail }) => {
            const { choice } = detail.answer as { readonly choice: string };
            question.question = {
              ...question.question!,
              status: 'submitted',
              answer: detail.answer,
            };
            const plan = element.plan!;
            element.plan = {
              ...plan,
              steps: plan.steps.map((s): PlanStep =>
                s.id === step.id
                  ? {
                      id: s.id,
                      title: s.title,
                      status: 'done',
                      detail: choice === 'major' ? 'Major version' : 'Minor version',
                    }
                  : // Publish was waiting for the version.
                    s.id === 'd'
                    ? { id: s.id, title: s.title, status: 'pending' }
                    : s,
              ),
            };
          },
        );
        return question;
      };
      let asked: HTMLElementTagNameMap['odd-question'] | undefined;
      scope.listen<GlobalEventHandlersEventMap['odd-plan-input-request']>(
        element,
        'odd-plan-input-request',
        ({ detail }) => {
          const step = element.plan?.steps.find((s) => s.id === detail.stepId);
          if (!step) return;
          const question = (asked ??= ask(step));
          void question.updateComplete.then(() => question.focus());
        },
      );
    },
  },
});
