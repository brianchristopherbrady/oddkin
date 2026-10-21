import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { BEGIN, END, renderSection, updateAgentsMd } from '../../scripts/agent-kit/agents-md.mjs';
import { resolveProjectContext } from '../../scripts/agent-kit/context.mjs';
import { acmeWorkspace, repo } from './acme.js';

// Agent-kit pilot, item 862: the managed AGENTS.md section (agent-tooling.md §5).
vi.setConfig({ testTimeout: 60_000 });

const section = `${BEGIN}\nnew\n${END}`;

describe('updateAgentsMd', () => {
  it('replaces only the managed section and keeps the text around it', () => {
    const text = `# Notes\n\nHand-written.\n\n${BEGIN}\nold\n${END}\n\nMore notes.\n`;
    expect(updateAgentsMd(text, section)).toBe(
      `# Notes\n\nHand-written.\n\n${section}\n\nMore notes.\n`,
    );
  });

  it('appends a section to a file without one, and creates one from nothing', () => {
    expect(updateAgentsMd('# Notes\n', section)).toBe(`# Notes\n\n${section}\n`);
    expect(updateAgentsMd('', section)).toBe(`${section}\n`);
  });

  it('is idempotent', () => {
    const once = updateAgentsMd('# Notes\n', section);
    expect(updateAgentsMd(once, section)).toBe(once);
  });

  it('refuses a file with one marker but not the other', () => {
    expect(() => updateAgentsMd(`${BEGIN}\nno end\n`, section)).toThrow(/markers/);
    expect(() => updateAgentsMd(`no begin\n${END}\n`, section)).toThrow(/markers/);
  });
});

describe('renderSection', () => {
  const root = acmeWorkspace();
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('describes a workspace from its manifests and metadata only', () => {
    const text = renderSection(resolveProjectContext(root));
    expect(text).toContain('- Setup: Node >=24, then `npm install`.');
    expect(text).toContain('`@acme/tokens` (packages/tokens), `@acme/ui` (packages/ui)');
    expect(text).toContain('class, template, and styles in one module (colocated authoring)');
    expect(text).toContain(
      '  - build: `npm run build`\n  - test: `npm test`\n  - lint: `npm run lint`',
    );
    expect(text).not.toMatch(/playwright|@oddkin\/components|dev:/);
  });

  it('keeps the repository’s own AGENTS.md section current', () => {
    const file = join(repo, 'AGENTS.md');
    expect(existsSync(file), 'run node scripts/agent-kit/agents-md.mjs --write').toBe(true);
    const text = readFileSync(file, 'utf8');
    expect(
      updateAgentsMd(text, renderSection(resolveProjectContext(repo))),
      'run node scripts/agent-kit/agents-md.mjs --write',
    ).toBe(text);
  });
});
