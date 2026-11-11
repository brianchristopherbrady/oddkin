import { defineExamples, type ExampleFixtureContext } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import type { SourceRecord } from './citation.js';

const source: SourceRecord = {
  type: 'source',
  id: 's1',
  sourceId: 'wcag',
  title: 'Web Content Accessibility Guidelines 2.2',
  url: 'https://www.w3.org/TR/WCAG22/',
  excerpt: 'Content can be presented without loss of information at 320 CSS pixels.',
};

function revealSources({
  scope,
  element,
  mount,
}: ExampleFixtureContext<HTMLElementTagNameMap['odd-citation']>) {
  const list = mount(
    html`<odd-sources label="Sources"></odd-sources>`,
  ) as HTMLElementTagNameMap['odd-sources'];
  list.sources = element.source ? [element.source] : [];
  scope.listen<GlobalEventHandlersEventMap['odd-source-reveal']>(
    element,
    'odd-source-reveal',
    ({ detail }) => list.reveal(detail.sourceId),
  );
}

export default defineExamples('odd-citation', {
  default: {
    label: 'Resolved citation',
    props: {
      sourceId: 'wcag',
      index: 1,
      source,
    },
    recommended: true,
    guidance:
      'The marker opens a named, anchored popover without moving the following content. Escape or Close source preview returns to the marker; pressing outside keeps focus at that destination. Show in sources sends `odd-citation-open` and, unless cancelled, `odd-source-reveal`; the host owns the source list and reveals the source there. Here it is an `odd-sources` list after the citation.',
    // The host: the answer's source list, which reveals the source the citation asks for.
    fixture: revealSources,
  },
  inlineAllocated: {
    label: 'Inline in an allocated details region',
    props: { sourceId: 'wcag', index: 1, source, presentation: 'inline' },
    guidance:
      'Choose `presentation="inline"` when the parent deliberately allocates a growing source-details region. Opening it moves the following content as part of that chosen layout; the working note remains mounted. Width does not change the presentation. A new presentation waits for an open preview to close.',
    fixture(context) {
      const region = context.mount(
        html`<section aria-label="Allocated source details">
          <p>This parent reserves room for source details to grow.</p>
          <div></div>
          <label
            >Working note<textarea rows="2">Keep this draft while checking the source.</textarea>
          </label>
        </section>`,
      );
      region.querySelector('div')!.append(context.element);
      revealSources(context);
    },
  },
  unresolved: {
    label: 'Unresolved citation',
    props: { sourceId: 'missing', index: 2 },
    guidance: 'A citation without a source says so instead of inventing one.',
  },
});
