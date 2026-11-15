// Renders primitives-audit.md from primitives-audit.json: --write writes it, --check fails when it is stale.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const MARK = { ok: 'ok', gap: 'gap', 'n/a': 'n/a', unknown: '?' };
const cell = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
const code = (text) => `\`${text}\``;
const list = (items) => (items?.length ? items.map(code).join(', ') : '—');

/** The Markdown view of the audit. */
export function render(audit) {
  const ids = audit.checks.map((c) => c.id);
  const out = [
    `# ${audit.title}`,
    '',
    '<!-- Generated from primitives-audit.json by primitives-audit.render.mjs. Edit the JSON, then run: node docs/research/primitives-audit.render.mjs --write -->',
    '',
    `${audit.requestedBy} Started ${audit.started}, ${audit.lane}. [primitives-audit.json](./primitives-audit.json) holds the same data for agents.`,
    '',
    '## Scope',
    '',
    audit.scope.includes,
    '',
    'Not in this audit:',
    '',
    ...audit.scope.excludes.map((e) => `- ${e.what}: ${e.why}`),
    '',
    ...(audit.notes?.length ? ['## Notes', '', ...audit.notes.map((n) => `- ${n}`), ''] : []),
    '## Checks',
    '',
    '| Check | Question |',
    '| --- | --- |',
    ...audit.checks.map((c) => `| ${c.name} | ${cell(c.question)} |`),
    '',
    `Each check is ok, gap, n/a, or ? (not checked yet). A primitive is ${audit.statuses.row.join(', ')}.`,
    '',
    '## Matrix',
    '',
    `| # | Primitive | Figma | Code | Status | ${audit.checks.map((c) => c.name).join(' | ')} |`,
    `| ${Array(5 + ids.length)
      .fill('---')
      .join(' | ')} |`,
  ];
  for (const p of audit.primitives) {
    const figma = p.figma
      .map((f) => `${f.family.replace('Oddkin/Common/', '')} (${f.id})`)
      .join(', ');
    const impl = [p.code.element, ...(p.code.recipes ?? [])].filter(Boolean).map(code).join(', ');
    out.push(
      `| ${p.order} | [${p.name}](#${p.order}-${p.name.toLowerCase()}) | ${cell(figma)} | ${cell(impl)} | ${p.status} | ${ids.map((id) => MARK[p.checks[id]]).join(' | ')} |`,
    );
  }
  for (const p of audit.primitives) {
    out.push('', `## ${p.order}. ${p.name}`, '');
    out.push(
      `Status: ${p.status}${p.audited ? ` (${p.audited})` : ''}.${p.summary ? ` ${p.summary}` : ''}`,
      '',
    );
    out.push('| Figma family | Id | Variants | Properties |', '| --- | --- | --- | --- |');
    for (const f of p.figma) {
      const axes =
        Object.entries(f.axes)
          .map(([k, v]) => `${k}: ${v.join(', ')}`)
          .join('; ') || '—';
      out.push(`| ${f.family} | ${f.id} | ${f.variants} | ${cell(axes)} |`);
    }
    const impl = [
      p.code.element && `${code(p.code.element)} (${p.code.source})`,
      ...(p.code.recipes ?? []).map(code),
    ];
    out.push(
      '',
      `Code: ${impl.filter(Boolean).join(', ')}.${p.code.note ? ` ${p.code.note}` : ''}`,
    );
    if (p.api) {
      out.push(
        '',
        '| Attributes | Slots | Parts | CSS properties | Events |',
        '| --- | --- | --- | --- | --- |',
        `| ${cell(list(p.api.attributes))} | ${cell(list(p.api.slots))} | ${cell(list(p.api.parts))} | ${cell(list(p.api.cssProperties))} | ${cell(list(p.api.events))} |`,
      );
    }
    if (p.findings.length) {
      out.push('', '| Finding | Check | What | Proposal |', '| --- | --- | --- | --- |');
      for (const f of p.findings)
        out.push(`| ${f.id} | ${f.check} | ${cell(f.finding)} | ${cell(f.proposal)} |`);
    }
    if (p.decisions.length) {
      out.push('', 'Decisions for the owner:', '');
      for (const d of p.decisions) {
        out.push(`- **${d.id}: ${d.question}** ${d.answer ? `Answer: ${d.answer}` : 'Open.'}`);
        d.options.forEach((option, i) => out.push(`  ${i + 1}. ${option}`));
        out.push(`  - Recommendation: ${d.recommendation}`);
      }
    }
    if (p.status === 'not started') out.push('', 'Not audited yet.');
  }
  return `${out.join('\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const audit = JSON.parse(readFileSync(here('./primitives-audit.json'), 'utf8'));
  const markdown = render(audit);
  const target = here('./primitives-audit.md');
  if (process.argv.includes('--write')) writeFileSync(target, markdown);
  else if (readFileSync(target, 'utf8') !== markdown) {
    console.error(
      'docs/research/primitives-audit.md is stale: run node docs/research/primitives-audit.render.mjs --write',
    );
    process.exit(1);
  }
}
