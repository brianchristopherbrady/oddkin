// The agent-kit generator lives in @oddkin/analyzer: the `oddkin-kit` command and the
// `@oddkin/analyzer/kit` entry. This script runs the built command (after `npm run build`):
//   node scripts/agent-kit/kit.mjs [--root <dir>] [--package <name>]... [--out <dir>]
//                                  [--theme-config <file>] [--check]
import { main } from '../../packages/analyzer/dist/kit/index.js';

process.exitCode = await main(process.argv.slice(2), {
  out: (text) => console.log(text),
  err: (text) => console.error(text),
});
