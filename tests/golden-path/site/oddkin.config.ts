// The library's Workbench site: its catalog, live previews, and Theme Studio on its own theme.
import { defineWorkbenchConfig } from '@oddkin/workbench/config';

export default defineWorkbenchConfig({
  library: { packages: ['@acme/widgets'] },
  branding: { name: 'Acme widgets' },
  // Previews load the library's own theme stylesheet instead of Oddkin's default theme.
  assets: ['@acme/widgets/theme.css'],
  themeStudio: { themeConfig: '../library/theme.json' },
});
