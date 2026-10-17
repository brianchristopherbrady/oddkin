# Plain-HTML consumer

Loads the built `dist/` output of every package through an import map, with no bundler or framework. Run `npm run build`, then `npm run test:e2e`, which serves the repository root and checks this page in Chromium, Firefox, and WebKit.

To open it manually: `npm run build`, then `node scripts/serve-static.mjs` and visit `http://localhost:4173/examples/plain-html/`.