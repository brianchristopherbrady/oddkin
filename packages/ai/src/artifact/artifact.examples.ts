import { defineExamples } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import type {} from './artifact.js';

const artifact = {
  artifactId: 'a1',
  title: 'Release notes',
  kind: 'markdown',
  currentRevisionId: 'r2',
  revisions: [
    { revisionId: 'r1', number: 1, content: '# Release notes\n\nDraft.' },
    {
      revisionId: 'r2',
      number: 2,
      summary: 'Added highlights',
      content: '# Release notes\n\n- Faster builds',
    },
  ],
};

export default defineExamples('odd-artifact', {
  default: {
    label: 'Preview',
    props: { artifact },
    recommended: true,
    guidance: 'The artifact keeps its identity across revisions; choose a revision to compare.',
  },
  source: {
    label: 'Source',
    props: { artifact, view: 'source' },
  },
  exports: {
    label: 'Export formats',
    props: { artifact, exports: [{ format: 'json', label: 'Export JSON' }] },
    guidance:
      "Copy and Download use the revision's own content. Each format in `exports` only asks (`odd-artifact-export` with the format and the revision); the host produces the file. Here the host writes the revision as JSON and links it.",
    fixture({ scope, element, mount }) {
      const exported = mount(html`<p></p>`);
      scope.listen<GlobalEventHandlersEventMap['odd-artifact-export']>(
        element,
        'odd-artifact-export',
        ({ detail }) => {
          const record = element.artifact;
          const revision = record?.revisions.find((r) => r.revisionId === detail.revisionId);
          if (detail.format !== 'json' || !record || !revision) return;
          const json = JSON.stringify(
            { title: record.title, revision: revision.number, content: revision.content },
            null,
            2,
          );
          const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
          scope.add(() => URL.revokeObjectURL(url));
          const link = document.createElement('a');
          link.href = url;
          link.download = `${record.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
          link.textContent = link.download;
          exported.replaceChildren(`Revision ${revision.number} as JSON: `, link);
        },
      );
    },
  },
  codeView: {
    label: 'Unsupported view',
    props: { artifact },
    attributes: { view: 'code' },
    incorrect: {
      explanation:
        '`view` accepts preview or source. Other values are reported and the preview is shown; use `source` for the raw content.',
      diagnostic: 'usage.attribute.value',
      correct: 'source',
    },
  },
});
