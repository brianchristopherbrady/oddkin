// The React sample of the docs' Framework guides (apps/docs/src/pages/guides.ts), copied exactly:
// tests/docs/pages.test.ts keeps the two the same, and `npm run typecheck` checks it here.
import type {} from '@oddkin/components/frameworks/react';
import '@oddkin/components/define/side-nav';
import type { NavigationItem } from '@oddkin/components/side-nav';

export function Shell({
  items,
  run,
}: {
  items: readonly NavigationItem[];
  run: (action: string) => void;
}) {
  return (
    <odd-side-nav
      label="Primary"
      items={items}
      current="overview"
      onodd-action={(event) => run(event.detail.action)}
    />
  );
}
