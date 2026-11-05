import { defineExamples } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import type {} from './citation.js';

export default defineExamples('odd-citation', {
  default: {
    label: 'Resolved citation',
    props: {
      sourceId: 'wcag',
      index: 1,
      source: {
        type: 'source',
        id: 's1',
        sourceId: 'wcag',
        title: 'Web Content Accessibility Guidelines 2.2',
        url: 'https://www.w3.org/TR/WCAG22/',
        excerpt: 'Content can be presented without loss of information at 320 CSS pixels.',
      },
    },
    recommended: true,
    guidance:
      'Show in sources sends `odd-source-reveal`; the host owns the source list and reveals the source there. Here the host is an `odd-sources` list after the citation.',
    // The host: the answer's source list, which reveals the source the citation asks for.
    fixture({ scope, element, mount }) {
      const list = mount(html`<odd-sources label="Sources"></odd-sources>`) as HTMLElement & {
        sources: readonly unknown[];
        reveal(sourceId: string): void;
      };
      list.sources = [(element as HTMLElement & { source: unknown }).source];
      scope.listen(element, 'odd-source-reveal', (event) => {
        list.reveal((event as CustomEvent<{ readonly sourceId: string }>).detail.sourceId);
      });
    },
  },
  unresolved: {
    label: 'Unresolved citation',
    props: { sourceId: 'missing', index: 2 },
    guidance: 'A citation without a source says so instead of inventing one.',
  },
});
