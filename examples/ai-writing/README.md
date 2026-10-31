# Inline writing assistant (simulated)

A static demonstration of `@oddkin/ai` on a native `textarea`: selections captured against a document revision (`captureSelection`), `odd-inline-assist` actions (rewrite, expand, translate as proposals; explain and summarize as results), `odd-change-review` with accept, reject, and undo through `DocumentSession`, stale proposals after edits, `odd-ai-label` provenance, dictation with `odd-voice-input` and a scripted adapter, and announcements through `createAnnouncer`.

Suggestions come from deterministic local functions; no network requests, model, or credentials.

Build with `npm run build`, serve with `node scripts/serve-static.mjs`, and open `http://localhost:4173/examples/ai-writing/`.

Simulation controls: response delay, "Edit the document now" (makes a pending proposal stale; it cannot be applied), and microphone permission denial. Exercised by `e2e/ai-demos.spec.ts`, on the workspace build and on a bundle that a new project builds from the packed packages (`scripts/ai-demos-consumer.mjs`).
