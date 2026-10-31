// The repository's AGENTS.md section. The generator lives in @oddkin/analyzer; this runs
// `oddkin-kit agents-md` (after `npm run build`):
//   node scripts/agent-kit/agents-md.mjs [--root <dir>] [--write | --check]
import { main } from '../../packages/analyzer/dist/kit/index.js';

process.exitCode = await main(['agents-md', ...process.argv.slice(2)], {
  out: (text) => console.log(text),
  err: (text) => console.error(text),
});
