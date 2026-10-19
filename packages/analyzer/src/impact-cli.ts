/**
 * `oddkin-impact` commands, kept free of a shebang so tests can import them.
 *
 *   oddkin-impact snapshot <package-dir>... --out <snapshot.json>
 *       [--theme <ThemeConfig.json> --inspection <name.inspect.json>]
 *       [--product <product.json>]... [--suite <id>@<version>:<tag>,<tag>]...
 *       [--migrations <migrations.json>] [--tool <name>=<version>]...
 *   oddkin-impact compare <base.json> <head.json>
 *       [--baseline <results.json>] [--results <results.json>]...
 *       [--json <report.json>] [--markdown <report.md>]
 *
 * Exit codes: 0 success; 1 a merged check failed; 2 usage or input error.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import {
  compareSnapshots,
  createSnapshot,
  mergeResults,
  readPackage,
  renderImpactMarkdown,
  type BaselineResult,
  type CheckResult,
  type ComparisonSnapshot,
  type Migration,
  type ProductManifest,
  type SnapshotInputs,
} from './impact.js';

export const USAGE = `Usage:
  oddkin-impact snapshot <package-dir>... --out <snapshot.json> [--theme <config.json> --inspection <inspect.json>] [--product <product.json>]... [--suite <id>@<version>:<tag>,...]... [--migrations <file.json>] [--tool <name>=<version>]...
  oddkin-impact compare <base.json> <head.json> [--baseline <results.json>] [--results <results.json>]... [--json <report.json>] [--markdown <report.md>]`;

const readJson = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
const write = (path: string, text: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

/** Run one command; returns the exit code. */
export function main(argv: readonly string[], io: Io): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        out: { type: 'string' },
        theme: { type: 'string' },
        inspection: { type: 'string' },
        product: { type: 'string', multiple: true },
        suite: { type: 'string', multiple: true },
        migrations: { type: 'string' },
        tool: { type: 'string', multiple: true },
        baseline: { type: 'string' },
        results: { type: 'string', multiple: true },
        json: { type: 'string' },
        markdown: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;
  if (values.help) {
    io.out(USAGE);
    return 0;
  }
  try {
    if (command === 'snapshot') {
      if (!rest.length || !values.out || !values.theme !== !values.inspection) {
        io.err(USAGE);
        return 2;
      }
      const suites = (values.suite ?? []).map((spec) => {
        const match = /^([^@]+)@([^:]+):(.+)$/.exec(spec);
        if (!match) throw new Error(`--suite ${spec}: expected <id>@<version>:<tag>,<tag>`);
        return {
          id: match[1] as string,
          version: match[2] as string,
          targets: (match[3] as string).split(','),
        };
      });
      const versions = Object.fromEntries(
        (values.tool ?? []).map((spec) => {
          const at = spec.indexOf('=');
          if (at < 1) throw new Error(`--tool ${spec}: expected <name>=<version>`);
          return [spec.slice(0, at), spec.slice(at + 1)];
        }),
      );
      const inputs: SnapshotInputs = {
        packages: rest.map(readPackage),
        ...(values.theme && values.inspection
          ? { theme: { config: readJson(values.theme), inspection: readJson(values.inspection) } }
          : {}),
        products: (values.product ?? []).map((path) => readJson<ProductManifest>(path)),
        suites,
        ...(values.migrations ? { migrations: readJson<Migration[]>(values.migrations) } : {}),
        versions,
      };
      const snapshot = createSnapshot(inputs);
      write(values.out, `${JSON.stringify(snapshot, null, 2)}\n`);
      io.out(
        `Snapshot: ${Object.keys(snapshot.items).length} items, ${snapshot.edges.length} edges, ${snapshot.unresolved.length} unresolved → ${values.out}`,
      );
      return 0;
    }
    if (command === 'compare') {
      const [basePath, headPath] = rest;
      if (!basePath || !headPath || rest.length > 2) {
        io.err(USAGE);
        return 2;
      }
      let report = compareSnapshots(
        readJson<ComparisonSnapshot>(basePath),
        readJson<ComparisonSnapshot>(headPath),
        values.baseline ? { baseline: readJson<BaselineResult[]>(values.baseline) } : {},
      );
      if (values.results)
        report = mergeResults(
          report,
          values.results.flatMap((path) => readJson<CheckResult[]>(path)),
        );
      if (values.json) write(values.json, `${JSON.stringify(report, null, 2)}\n`);
      const markdown = renderImpactMarkdown(report);
      if (values.markdown) write(values.markdown, markdown);
      io.out(markdown);
      return report.checks.some((c) => c.state === 'failed') ? 1 : 0;
    }
    io.err(USAGE);
    return 2;
  } catch (error) {
    io.err(`oddkin-impact: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}
