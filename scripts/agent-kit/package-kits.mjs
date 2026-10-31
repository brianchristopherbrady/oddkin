// The kits the component packages ship (`<package>/agent/`), written by the last step of
// `npm run build`. The generator lives in @oddkin/analyzer; this runs `oddkin-kit package`:
//   node scripts/agent-kit/package-kits.mjs [--root <dir>] [--package <name>]... [--check]
import { main } from '../../packages/analyzer/dist/kit/index.js';

process.exitCode = await main(['package', ...process.argv.slice(2)], {
  out: (text) => console.log(text),
  err: (text) => console.error(text),
});
