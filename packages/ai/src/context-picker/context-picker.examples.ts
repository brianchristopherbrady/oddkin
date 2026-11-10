import type { Scope } from '@oddkin/core/scope';
import { defineExamples } from '@oddkin/workbench/examples';
import type { ContextResource, ContextSource } from '../contracts/types.js';
import type {} from './context-picker.js';

const sources: ContextSource[] = [
  { id: 'drive', label: 'Drive' },
  { id: 'wiki', label: 'Wiki' },
  { id: 'records', label: 'Records' },
];

const library: ContextResource[] = [
  {
    sourceId: 'drive',
    id: 'launch-brief',
    label: 'Launch brief',
    type: 'document',
    path: 'Product / Launch',
    description: '2h ago',
  },
  {
    sourceId: 'wiki',
    id: 'release-checklist',
    label: 'Release checklist',
    type: 'page',
    path: 'Platform team',
    description: 'Yesterday',
  },
  {
    sourceId: 'drive',
    id: 'customer-interviews',
    label: 'Customer interviews',
    type: 'document',
    path: 'Research',
    description: '3 days ago',
  },
  {
    sourceId: 'records',
    id: 'acme-renewal',
    label: 'Acme renewal',
    type: 'account',
    path: 'Account',
    description: 'Updated today',
  },
  {
    sourceId: 'wiki',
    id: 'launch-checklist',
    label: 'Launch checklist',
    type: 'page',
    path: 'Platform team',
    description: 'Yesterday',
  },
  {
    sourceId: 'drive',
    id: 'launch-retrospective',
    label: 'Launch retrospective',
    type: 'document',
    path: 'Research',
    description: 'Last month',
  },
  {
    sourceId: 'drive',
    id: 'pricing-notes',
    label: 'Pricing notes',
    type: 'document',
    path: 'Sales',
    unavailable: 'Unavailable · Remove or replace',
  },
];

type Picker = HTMLElementTagNameMap['odd-context-picker'];

/** The host: answers each search from `library` after a short delay, and accepts every change. */
function host(scope: Scope, element: Picker): void {
  scope.listen<GlobalEventHandlersEventMap['odd-context-query']>(
    element,
    'odd-context-query',
    ({ detail }) => {
      const query = detail.query.toLocaleLowerCase();
      scope.timeout(() => {
        if (detail.signal.aborted) return;
        element.results = {
          requestId: detail.requestId,
          items: library.filter(
            (r) =>
              detail.sourceIds.includes(r.sourceId) && r.label.toLocaleLowerCase().includes(query),
          ),
          sources: detail.sourceIds.map((sourceId) => ({ sourceId, status: 'complete' as const })),
        };
      }, 300);
    },
  );
  scope.listen<GlobalEventHandlersEventMap['odd-context-change']>(
    element,
    'odd-context-change',
    ({ detail }) => {
      element.value = detail.value;
    },
  );
}

export default defineExamples('odd-context-picker', {
  default: {
    label: 'Choose context from connected sources',
    props: {
      sources,
      multiple: true,
      open: true,
      results: {
        requestId: 'recent',
        items: [
          {
            sourceId: 'drive',
            id: 'launch-brief',
            label: 'Launch brief',
            type: 'document',
            path: 'Product / Launch',
            description: '2h ago',
          },
          {
            sourceId: 'wiki',
            id: 'release-checklist',
            label: 'Release checklist',
            type: 'page',
            path: 'Platform team',
            description: 'Yesterday',
          },
        ],
      },
      value: [
        {
          sourceId: 'drive',
          id: 'launch-brief',
          label: 'Launch brief',
          type: 'document',
          path: 'Product / Launch',
          description: '2h ago',
        },
      ],
    },
    recommended: true,
    guidance:
      'The host answers each `odd-context-query` with `results` carrying its `requestId`, and accepts a change by setting `value` in the `odd-context-change` handler. Show the chosen resources outside the picker (chips or rows), each removable.',
    fixture({ scope, element }) {
      host(scope, element);
    },
  },
  confirm: {
    label: 'Choose one, then apply',
    props: { sources, commit: 'confirm' },
    guidance:
      'With `commit="confirm"` choices stay a draft until Add N; Cancel, Close, Escape, or leaving the surface discards them. Without `multiple`, choosing replaces the choice.',
    fixture({ scope, element }) {
      host(scope, element);
    },
  },
});
