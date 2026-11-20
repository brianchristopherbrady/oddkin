// The docs site's component and AI reference pages, built by Workbench in Node (example values
// come from the packages' *.examples.ts sources) and served under /_oddkin/ (embedFiles).
import { readFileSync } from 'node:fs';
import { defineWorkbenchConfig } from '@oddkin/workbench/config';
import { publicAiCategories } from './public-ai-components.mjs';

const { categories } = JSON.parse(
  readFileSync(new URL('../../packages/components/oddkin.metadata.json', import.meta.url), 'utf8'),
) as { categories: Record<string, { label: string; order?: number }> };

export default defineWorkbenchConfig({
  library: { packages: ['@oddkin/components', '@oddkin/ai'] },
  categories: {
    definitions: Object.entries(categories).map(([key, category]) => ({
      id: key.replace(/^category:/, ''),
      ...category,
    })),
    assign: publicAiCategories,
  },
  branding: { name: 'Oddkin' },
  themeStudio: { themeConfig: '../../packages/tokens/themes/default.theme.json' },
});
