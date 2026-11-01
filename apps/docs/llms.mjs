// The site's llms.txt (llmstxt.org) and the agent kit files it links, written by the analyzer's
// `oddkin-kit llms` (agent-tooling.md §5, Discovery). Every link is absolute under `base`.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { siteFacts } from './facts.mjs';

export async function writeLlms(root, out, base) {
  const { main } = await import(
    pathToFileURL(join(root, 'packages/analyzer/dist/kit/index.js')).href
  );
  const { description } = await siteFacts(root);
  const problems = [];
  const code = await main(
    ['llms', '--root', root, '--out', out, '--base', base, '--title', 'Oddkin'].concat(
      description ? ['--summary', description] : [],
    ),
    { out: () => {}, err: (text) => problems.push(text) },
  );
  for (const problem of problems) console.error(problem);
  if (code !== 0) throw new Error(`oddkin-kit llms exited with ${code}.`);
}
