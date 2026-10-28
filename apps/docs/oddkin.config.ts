// The docs site's component and AI reference pages, built by Workbench in Node (example values
// come from the packages' *.examples.ts sources) and served under /_oddkin/ (embedFiles).
import { defineWorkbenchConfig } from '@oddkin/workbench/config';

export default defineWorkbenchConfig({
  library: { packages: ['@oddkin/components', '@oddkin/ai'] },
  branding: { name: 'Oddkin' },
  themeStudio: { themeConfig: '../../packages/tokens/themes/default.theme.json' },
});
