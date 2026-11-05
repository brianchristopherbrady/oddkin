import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './context-picker.js';

type Item = {
  readonly id: string;
  readonly kind: 'file' | 'url';
  readonly label: string;
  readonly status: 'uploading' | 'processing' | 'ready' | 'failed';
  readonly url?: string;
  readonly size?: number;
  readonly preview?: string;
  readonly error?: { readonly code: string; readonly message: string };
};
type AddDetail =
  | { readonly kind: 'file'; readonly files: readonly File[] }
  | { readonly kind: 'url'; readonly url: string };

const items: Item[] = [
  {
    id: 'f1',
    kind: 'file',
    label: 'q3-report.pdf',
    status: 'ready',
    size: 482_000,
    preview: 'Q3 revenue grew 12% on subscription renewals; churn fell to 2.1%.',
  },
  {
    id: 'u1',
    kind: 'url',
    label: 'Release notes',
    status: 'processing',
    url: 'https://example.com/notes',
  },
  {
    id: 'f2',
    kind: 'file',
    label: 'scan.tiff',
    status: 'failed',
    error: { code: 'unsupported', message: 'This file type cannot be read.' },
  },
];

export default defineExamples('odd-context-picker', {
  default: {
    label: 'Add and remove context',
    props: { items, allowUrls: true },
    recommended: true,
    guidance:
      'Add files, Add link, and Remove only ask (`odd-context-add`, `odd-context-remove`); an item appears or goes once the host changes `items`. Here the host adds each item as uploading or processing and marks it ready a moment later. Inspect shows the `preview` of an item.',
    fixture({ scope, element }) {
      const picker = element as HTMLElement & { items: readonly Item[] };
      let added = 0;
      scope.listen(element, 'odd-context-add', (event) => {
        const detail = (event as CustomEvent<AddDetail>).detail;
        const next: Item[] =
          detail.kind === 'url'
            ? [
                {
                  id: `added-${++added}`,
                  kind: 'url',
                  label: detail.url,
                  url: detail.url,
                  status: 'processing',
                },
              ]
            : detail.files.map((file) => ({
                id: `added-${++added}`,
                kind: 'file',
                label: file.name,
                size: file.size,
                status: 'uploading',
              }));
        picker.items = [...picker.items, ...next];
        const ids = new Set(next.map((item) => item.id));
        scope.timeout(() => {
          picker.items = picker.items.map((item) =>
            ids.has(item.id) ? { ...item, status: 'ready' } : item,
          );
        }, 600);
      });
      scope.listen(element, 'odd-context-remove', (event) => {
        const { itemId } = (event as CustomEvent<{ readonly itemId: string }>).detail;
        picker.items = picker.items.filter((item) => item.id !== itemId);
      });
    },
  },
});
