// Authored content for the docs site's reference pages (docs-content.v1): the titles a tag name
// cannot spell. Workbench reads this file from the configuration's folder.
import { defineDocs } from '@oddkin/workbench/config';

export default defineDocs({
  pages: {
    'components/odd-ai-label': { title: 'AI label' },
    'components/odd-one-time-code': { title: 'One-time code' },
  },
});
