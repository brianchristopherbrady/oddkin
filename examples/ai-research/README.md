# Research assistant (simulated)

A static demonstration of `@oddkin/ai`: composer with attachments and suggestions, context picker with simulated upload progress, model selection, streaming Markdown with citations (one deliberately unresolved), a streamed tool call, sources, a revisioned artifact, usage with measured/estimated/unknown values, history loading, stop, disconnect and resume, and conversation isolation.

Everything is simulated by `createSimulatedTransport` with deterministic fixtures (`src/fixtures.js`); no network requests, model, or credentials.

Build and serve:

```sh
npm run build                       # bundles src/main.js into dist/ (production exports)
node scripts/serve-static.mjs       # then open http://localhost:4173/examples/ai-research/
```

Prompts containing "tool fail" make the tool fail; "drop" drops the connection midway (the attempt becomes interrupted; Retry or Resume). The simulation controls reject the next send, choose the stop outcome and delay, disconnect, resume, switch conversations, and inject a late event for the previous conversation (it is ignored). Exercised by `e2e/ai-demos.spec.ts`, on the workspace build and on a bundle that a new project builds from the packed packages (`scripts/ai-demos-consumer.mjs`).
