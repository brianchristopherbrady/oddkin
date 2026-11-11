import type { Scope } from '@oddkin/core/scope';
import { defineExamples, type ExampleSet } from '@oddkin/workbench/examples';
import type { OddkinContainer } from '@oddkin/components/container';
import { behaviorExamples, mountPublishedExample } from './behavior-data.js';
import { loadComponent, loadIndex } from './reference.js';
import '@oddkin/components/define/container';
import '@oddkin/components/define/button';
import '@oddkin/components/define/disclosure';
import '@oddkin/components/define/tabs';
import '@oddkin/components/define/tab-panel';
import '@oddkin/components/define/dialog';
import '@oddkin/components/define/validation-summary';
import '@oddkin/components/define/input';
import '@oddkin/components/define/textarea';
import '@oddkin/components/define/toolbar';
import '@oddkin/components/define/menu';
import '@oddkin/ai/define/question';
import '@oddkin/ai/define/model-select';
import '@oddkin/ai/define/sources';
import '@oddkin/ai/define/tool-call';

export { render as oddkinFrameRender } from '@oddkin/core/template';

export const behaviorScenarios = [
  {
    name: 'review-in-disclosure',
    label: 'A review inside a disclosure',
    guidance:
      'Start an answer, close Review details, then reopen it. The same form and draft remain. Answer and Skip receive a local simulated record outcome.',
  },
  {
    name: 'toolbar-tools',
    label: 'Related controls in one action area',
    guidance:
      'Change the model, use the note actions, and open the menu while resizing. The parent lets control groups wrap; actions affect only this working note.',
  },
  {
    name: 'details-in-tabs',
    label: 'Supporting details in tabs',
    guidance:
      'Write a source note, switch to Tool result and retry the example call, then return. Both panels keep their state. Source links stay in this local preview.',
  },
  {
    name: 'form-in-dialog',
    label: 'An editing task in a dialog',
    guidance:
      'Open the editor, try an empty submission, and keep a draft. Escape closes the explicitly opened task and returns to its opener; reopening keeps the same form.',
  },
] as const;

const node = <T extends keyof HTMLElementTagNameMap>(tag: T, text?: string) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
};
const stack = <T extends HTMLElement>(element: T): T => {
  element.classList.add('odd-stack');
  element.style.setProperty('--odd-stack-gap', 'var(--odd-space-sm, .75rem)');
  element.style.minInlineSize = '0';
  return element;
};
const note = (text: string) => {
  const element = node('p', text);
  element.style.margin = '0';
  element.style.color = 'var(--odd-color-text-secondary)';
  element.style.fontSize = '.875rem';
  element.style.lineHeight = '1.65';
  element.style.overflowWrap = 'anywhere';
  return element;
};
const button = (label: string) => {
  const element = node('button', label);
  element.type = 'button';
  element.className = 'odd-button';
  element.style.justifySelf = 'start';
  return element;
};
const output = () => {
  const element = node('output');
  element.setAttribute('aria-live', 'polite');
  element.style.fontSize = '.875rem';
  element.style.lineHeight = '1.6';
  return element;
};
function scene(scope: Scope, parent: HTMLElement, name: string) {
  const element = stack(node('section'));
  element.dataset.behaviorScenario = name;
  element.setAttribute('aria-label', behaviorScenarios.find((entry) => entry.name === name)!.label);
  parent.append(element);
  scope.add(() => element.remove(), 'behavior scenario');
  return element;
}
async function published<T extends keyof HTMLElementTagNameMap>(
  tag: T,
  name: string,
  parent: HTMLElement,
  scope: Scope,
) {
  const mounted = await mountPublishedExample(tag, name, parent, scope);
  mounted.root.style.minInlineSize = '0';
  return mounted;
}

function answerLocally(question: HTMLElementTagNameMap['odd-question'], scope: Scope) {
  type Answer = GlobalEventHandlersEventMap['odd-question-answer']['detail'];
  type Skip = GlobalEventHandlersEventMap['odd-question-skip']['detail'];
  const settle = (detail: Answer | Skip, outcome: 'answered' | 'skipped') => {
    const current = question.question;
    if (
      !current ||
      current.questionId !== detail.questionId ||
      current.revision !== detail.revision ||
      !['requested', 'failed'].includes(current.status)
    )
      return;
    const pending = { ...current, status: 'submitting' as const };
    question.question = pending;
    scope.timeout(() => {
      if (question.question !== pending) return;
      question.question = {
        ...current,
        status: outcome,
        ...('answer' in detail ? { answer: detail.answer } : {}),
      };
    }, 450);
  };
  scope.listen<GlobalEventHandlersEventMap['odd-question-answer']>(
    question,
    'odd-question-answer',
    ({ detail }) => settle(detail, 'answered'),
  );
  scope.listen<GlobalEventHandlersEventMap['odd-question-skip']>(
    question,
    'odd-question-skip',
    ({ detail }) => settle(detail, 'skipped'),
  );
}

const behaviorScenarioExamples: ExampleSet<OddkinContainer> = defineExamples('odd-container', {
  'review-in-disclosure': {
    ...behaviorScenarios[0],
    props: { measure: 'fluid' },
    async fixture({ scope, element }) {
      const root = scene(scope, element, 'review-in-disclosure');
      root.append(note(behaviorScenarios[0].guidance));
      const disclosure = node('odd-disclosure');
      disclosure.label = 'Review details';
      disclosure.open = true;
      const body = stack(node('div'));
      disclosure.append(body);
      root.append(disclosure);
      const mounted = await published('odd-question', 'form', body, scope);
      // Supply an outcome only when the published example has no host fixture of its own.
      const abort = new AbortController();
      scope.add(() => abort.abort(), 'review example metadata');
      const page = await loadComponent(await loadIndex(abort.signal), 'odd-question', abort.signal);
      const example = page && behaviorExamples(page).find((entry) => entry.name === 'form');
      if (!scope.disposed && example && !example.fixture) answerLocally(mounted.element, scope);
      body.append(note('A recorded answer is separate from completing the wider task.'));
      await disclosure.updateComplete;
    },
  },
  'toolbar-tools': {
    ...behaviorScenarios[1],
    props: { measure: 'fluid' },
    async fixture({ scope, element }) {
      const root = scene(scope, element, 'toolbar-tools');
      root.append(note(behaviorScenarios[1].guidance));
      const groups = node('div');
      groups.classList.add('odd-cluster');
      Object.assign(groups.style, {
        alignItems: 'start',
        gap: 'var(--odd-space-sm, .75rem)',
        minInlineSize: '0',
      });
      root.append(groups);
      const toolbar = await published('odd-toolbar', 'default', groups, scope);
      toolbar.element.label = 'Working note actions';
      toolbar.root.style.flex = '1 1 100%';
      const menu = await published('odd-menu', 'default', groups, scope);
      menu.element.textContent = 'More note actions';
      menu.element.items = [
        { id: 'heading', label: 'Add a heading' },
        { id: 'reset', label: 'Reset the example note' },
      ];
      const model = await published('odd-model-select', 'default', groups, scope);
      model.root.style.flex = '1 1 12rem';
      const working = await published('odd-textarea', 'default', root, scope);
      const initial = 'Compare the proposed changes before continuing.';
      working.element.label = 'Working note';
      working.element.value = initial;
      const result = output();
      result.textContent = 'Actions are local to this example.';
      root.append(result);
      const commands: readonly [string, () => void][] = [
        [
          'Add note',
          () => {
            working.element.value += '\nCheck the supporting details.';
            result.textContent = 'A reminder was added to the working note.';
          },
        ],
        [
          'Clear note',
          () => {
            working.element.value = '';
            result.textContent = 'The working note was cleared.';
          },
        ],
        [
          'Review note',
          () => {
            result.textContent = working.element.value.trim()
              ? 'This local note is ready to review.'
              : 'Add a note before reviewing it.';
          },
        ],
      ];
      // These are the source example's public light-DOM controls.
      [...toolbar.element.querySelectorAll('odd-button')].forEach((control, index) => {
        const command = commands[index];
        if (!command) return;
        control.textContent = command[0];
        scope.listen(control, 'click', command[1]);
      });
      scope.listen<GlobalEventHandlersEventMap['odd-action']>(
        menu.element,
        'odd-action',
        ({ detail }) => {
          if (detail.id === 'heading') {
            working.element.value = `Review notes\n${working.element.value}`;
            result.textContent = 'A heading was added to the working note.';
          } else if (detail.id === 'reset') {
            working.element.value = initial;
            result.textContent = 'The example note was restored.';
          }
        },
      );
      scope.listen<GlobalEventHandlersEventMap['odd-model-change']>(
        model.element,
        'odd-model-change',
        ({ detail }) => {
          result.textContent = `Model choice changed to ${detail.modelId}. The note was kept.`;
        },
      );
    },
  },
  'details-in-tabs': {
    ...behaviorScenarios[2],
    props: { measure: 'fluid' },
    async fixture({ scope, element }) {
      const root = scene(scope, element, 'details-in-tabs');
      root.append(note(behaviorScenarios[2].guidance));
      const tabs = node('odd-tabs');
      tabs.label = 'Supporting details';
      tabs.value = 'sources';
      const sourcesPanel = node('odd-tab-panel');
      sourcesPanel.label = 'Sources';
      sourcesPanel.value = 'sources';
      const toolPanel = node('odd-tab-panel');
      toolPanel.label = 'Tool result';
      toolPanel.value = 'tool';
      tabs.append(sourcesPanel, toolPanel);
      root.append(tabs);
      const sourcesBody = stack(node('div'));
      const toolBody = stack(node('div'));
      sourcesPanel.append(sourcesBody);
      toolPanel.append(toolBody);
      const sources = await published('odd-sources', 'default', sourcesBody, scope);
      scope.listen(sources.element, 'click', (event: Event) => {
        if (event.composedPath().some((target) => target instanceof HTMLAnchorElement))
          event.preventDefault();
      });
      const sourceNote = await published('odd-textarea', 'default', sourcesBody, scope);
      sourceNote.element.label = 'Source note';
      sourceNote.element.value = 'Keep this observation while inspecting the tool result.';
      await published('odd-tool-call', 'failed', toolBody, scope);
      toolBody.append(note('Retry receives the source example’s local simulated tool result.'));
      await tabs.updateComplete;
    },
  },
  'form-in-dialog': {
    ...behaviorScenarios[3],
    props: { measure: 'fluid' },
    async fixture({ scope, element }) {
      const root = scene(scope, element, 'form-in-dialog');
      root.append(note(behaviorScenarios[3].guidance));
      const open = button('Edit review details');
      const dialog = node('odd-dialog');
      dialog.label = 'Edit review details';
      root.append(open, dialog);
      scope.add(() => dialog.close(), 'behavior dialog');
      const form = stack(node('form'));
      dialog.append(form);
      const summary = node('odd-validation-summary');
      summary.label = 'Please check the review details';
      form.append(summary);
      const title = await published('odd-input', 'required', form, scope);
      title.element.label = 'Review title';
      title.element.name = 'title';
      title.element.setAttribute('autofocus', '');
      const preparation = await published('odd-textarea', 'default', form, scope);
      preparation.element.label = 'Preparation note';
      preparation.element.name = 'note';
      preparation.element.value = 'Keep this draft when the dialog closes.';
      const submit = button('Check details');
      submit.type = 'submit';
      const result = output();
      form.append(submit, result);
      const close = button('Keep draft and close');
      close.slot = 'footer';
      dialog.append(close);
      scope.listen(open, 'click', () => {
        open.focus({ preventScroll: true });
        dialog.show();
      });
      scope.listen(close, 'click', () => dialog.close());
      scope.listen(form, 'submit', (event: SubmitEvent) => {
        event.preventDefault();
        result.textContent = 'The local details are valid. Your draft remains in this editor.';
      });
      await dialog.updateComplete;
    },
  },
});

export default behaviorScenarioExamples;
