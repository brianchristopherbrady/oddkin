// Oddkin's own components documented by Workbench: the "Full Oddkin" fixture for the dev server
// and e2e/workbench*.spec.ts. `@oddkin/components` resolves through the workspace's node_modules.
import { defineWorkbenchConfig } from '@oddkin/workbench/config';

export default defineWorkbenchConfig({
  library: { packages: ['@oddkin/components'] },
  branding: { name: 'Oddkin components' },
});
