// Experiment: Workbench from packed tarballs. Oddkin's components and a library without Oddkin.
import { defineWorkbenchConfig } from '@oddkin/workbench/config';

export default defineWorkbenchConfig({
  library: { packages: ['@oddkin/components', '@plain/widgets'] },
  branding: { name: 'Packed Workbench' },
  themeStudio: { themeConfig: './oddkin.theme.json' },
});
