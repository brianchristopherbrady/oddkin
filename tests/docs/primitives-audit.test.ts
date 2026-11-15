import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const path = (name: string) =>
  fileURLToPath(new URL(`../../docs/research/${name}`, import.meta.url));
const audit = JSON.parse(readFileSync(path('primitives-audit.json'), 'utf8'));

describe('the base primitives audit (docs/research/primitives-audit.json)', () => {
  it('lists the primitives in alphabetical order, numbered from 1', () => {
    const names: string[] = audit.primitives.map((p: { name: string }) => p.name);
    expect(names).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
    );
    expect(audit.primitives.map((p: { order: number }) => p.order)).toEqual(
      names.map((_, i) => i + 1),
    );
  });

  it('uses only the statuses and checks it defines', () => {
    const ids = audit.checks.map((c: { id: string }) => c.id);
    for (const p of audit.primitives) {
      expect(audit.statuses.row, p.name).toContain(p.status);
      expect(Object.keys(p.checks), p.name).toEqual(ids);
      for (const value of Object.values(p.checks))
        expect(audit.statuses.check, p.name).toContain(value);
      for (const f of p.findings)
        expect(audit.statuses.finding, `${p.name} ${f.id}`).toContain(f.check);
    }
  });

  it('is rendered in primitives-audit.md', () => {
    expect(() =>
      execFileSync(process.execPath, [path('primitives-audit.render.mjs'), '--check'], {
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
