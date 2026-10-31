# Agent task panel (simulated)

A static demonstration of `@oddkin/ai` with **application-owned state**: a small store (`getSnapshot`/`subscribe`) holds the plan, tools, approval, question, checkpoints, and run log; elements render those records and emit intent events that the page handles. The run log is an `odd-conversation` whose source is derived from the store with `selectSource` and `createConversationView`.

Shows `odd-task-plan` (parallel tasks, needs-input, blocked), `odd-activity` (Stop), two parallel `odd-tool-call`s (one can fail and be retried), `odd-question`, `odd-action-approval` bound to a revision (approval is not success; the deploy runs separately), and `odd-checkpoint` with confirmed or failed restoration.

A local timer script plays the agent; no network requests, model, or credentials. Build with `npm run build`, serve with `node scripts/serve-static.mjs`, and open `http://localhost:4173/examples/ai-agent/`.

Simulation controls: make one tool fail, approval expiry after 4 seconds, failing restore, pace, and "Change the pending proposal" (a new revision; decisions for the old one are refused). Exercised by `e2e/ai-demos.spec.ts`, on the workspace build and on a bundle that a new project builds from the packed packages (`scripts/ai-demos-consumer.mjs`).
