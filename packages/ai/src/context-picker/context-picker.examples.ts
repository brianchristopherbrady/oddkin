import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './context-picker.js';

export default defineExamples('odd-context-picker', {
  default: {
    label: 'Context items',
    props: {
      items: [
        { id: 'f1', kind: 'file', label: 'q3-report.pdf', status: 'ready', size: 482_000 },
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
      ],
      allowUrls: true,
    },
    recommended: true,
  },
});
