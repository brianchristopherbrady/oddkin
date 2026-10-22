# Two copies of `@oddkin/core` on one page

Two independently built consumers, each bundled with esbuild and each carrying its own copy of `@oddkin/core` (and of the button module):

- `src/consumer-a.js` registers `<odd-button>` and `<a-greeting>`, and shares one signal.
- `src/consumer-b.js` shows that signal in its own element's template (`<b-mirror>`), once bound as is and once bridged with `fromExternal(toExternal(…))`, and tries to register `<odd-button>` again from its copy.

What crosses copies and what does not is the contract in [core-contracts.md §5.1](../../docs/architecture/core-contracts.md). `e2e/duplicate-core.spec.ts` builds the bundles in memory and checks it in Chromium, Firefox, and WebKit. To open the page yourself:

```sh
npm run build
node examples/duplicate-core/build.mjs   # writes examples/duplicate-core/dist/
node scripts/serve-static.mjs            # then open http://localhost:4173/examples/duplicate-core/
```
