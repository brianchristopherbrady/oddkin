import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AI_DEMOS, AI_DESCRIPTION } from '../../apps/docs/src/ai.js';

// The AI interfaces page (apps/docs/src/ai.ts) states facts about @oddkin/ai; they must match it.
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('the AI interfaces page', () => {
  it('describes @oddkin/ai with its manifest description', () => {
    expect(AI_DESCRIPTION).toBe(
      (JSON.parse(read('packages/ai/package.json')) as { description: string }).description,
    );
  });

  it('lists the README demos by their own titles, with elements they use', () => {
    const tags = Object.values(
      (
        JSON.parse(read('packages/ai/oddkin.metadata.json')) as {
          components: Record<string, { tag: string }>;
        }
      ).components,
    ).map(({ tag }) => tag);
    const readme = read('packages/ai/README.md');
    for (const demo of AI_DEMOS) {
      expect(readme).toContain(`(../../examples/${demo.dir}/)`);
      const html = read(`examples/${demo.dir}/index.html`);
      expect(/<title>([^<]+)<\/title>/.exec(html)?.[1]).toMatch(
        new RegExp(`^${demo.title} \u2014`),
      );
      for (const tag of demo.elements) {
        expect(tags, `${demo.dir}: ${tag}`).toContain(tag);
        expect(html + read(`examples/${demo.dir}/README.md`), `${demo.dir}: ${tag}`).toMatch(
          new RegExp(`${tag}|${tag.replace(/^odd-/, '').replace(/-/g, ' ')}`, 'i'),
        );
      }
    }
  });
});
