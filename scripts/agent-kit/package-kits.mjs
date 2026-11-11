// The kits the component packages ship (`<package>/agent/`), written by the last step of
// `npm run build`. The generator lives in @oddkin/analyzer; this runs `oddkin-kit package`:
//   node scripts/agent-kit/package-kits.mjs [--root <dir>] [--package <name>]... [--check]
import { main } from '../../packages/analyzer/dist/kit/index.js';
import { resolve } from 'node:path';
import { syncResponsiveness } from './responsiveness.mjs';

const args = process.argv.slice(2);
const rootOption = args.find((arg) => arg.startsWith('--root='));
const rootIndex = args.indexOf('--root');
const rootValue =
  rootOption?.slice('--root='.length) ?? (rootIndex >= 0 ? args[rootIndex + 1] : '.');
// Let the CLI report a malformed option without first writing into the caller's workspace.
const guidance =
  rootValue && !rootValue.startsWith('--')
    ? await syncResponsiveness(resolve(rootValue), { check: args.includes('--check') })
    : { ok: true, changed: [] };
if (!guidance.ok)
  console.error(`error agent.guidance.stale: ${guidance.changed.join(', ')}. Run npm run build.`);
const result = await main(['package', ...args], {
  out: (text) => console.log(text),
  err: (text) => console.error(text),
});
process.exitCode = guidance.ok ? result : 1;
