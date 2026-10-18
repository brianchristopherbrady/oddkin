/**
 * Attach test evidence to `oddkin.metadata.json` as `verified` facts (metadata-and-analyzer.md
 * §3). Evidence is `conformance-result.v1` records whose configuration names the exact inputs
 * tested (`manifest`, `sources` hashes). A fact is verified only when every required browser has
 * a record for the current inputs and the case passed in each; stale, failed, or missing evidence
 * leaves it unverified and is reported. Pure: callers read files and compute hashes.
 */

export interface ResultRecord {
  readonly suite: { readonly id: string; readonly version: string };
  readonly implementation: { readonly tag: string; readonly package?: string };
  readonly configuration: Readonly<Record<string, string>>;
  readonly date: string;
  readonly results: readonly {
    readonly case: string;
    readonly state: 'passed' | 'failed' | 'not-executed';
    readonly message?: string;
  }[];
}

export interface VerificationInputs {
  /** Hash of each input a record must match, e.g. `{ manifest, sources }`. */
  readonly inputs: Readonly<Record<string, string>>;
  /** Browsers that must all have passed a case for it to be verified. */
  readonly browsers: readonly string[];
  /** The test file that produced the records (recorded as the fact source). */
  readonly test: string;
  /** Tags that must have current evidence; a tag without any is reported missing in every browser. */
  readonly require?: readonly string[];
}

export interface VerificationReport {
  readonly verified: Readonly<Record<string, number>>;
  readonly failed: readonly { tag: string; browser: string; case: string; message?: string }[];
  readonly notExecuted: readonly { tag: string; case: string }[];
  /** Records for other inputs than the current ones (ignored). */
  readonly stale: readonly { tag: string; browser: string }[];
  /** Required browsers without a current record, per tag. */
  readonly missing: readonly { tag: string; browser: string }[];
}

interface Group {
  suite: string;
  tag: string;
  pkg?: string;
  byBrowser: Map<string, ResultRecord>;
}

const sortedKeys = (value: Readonly<Record<string, string>>) =>
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** Stable short id of a run's inputs (FNV-1a over the suite and input hashes). */
function runId(suite: string, inputs: Readonly<Record<string, string>>): string {
  let hash = 0x811c9dc5;
  for (const char of `${suite}\u0000${JSON.stringify(sortedKeys(inputs))}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `run-${hash.toString(16).padStart(8, '0')}`;
}

export function attachVerification(
  metadata: Readonly<Record<string, unknown>>,
  records: readonly ResultRecord[],
  options: VerificationInputs,
): { metadata: Record<string, unknown>; report: VerificationReport } {
  const components = {
    ...((metadata['components'] ?? {}) as Record<string, Record<string, unknown>>),
  };
  const stale: { tag: string; browser: string }[] = [];
  const groups = new Map<string, Group>();
  for (const record of records) {
    const browser = record.configuration['browser'] ?? 'unknown';
    const tag = record.implementation.tag;
    const current = Object.entries(options.inputs).every(
      ([key, hash]) => record.configuration[key] === hash,
    );
    if (!current) {
      stale.push({ tag, browser });
      continue;
    }
    const suite = `${record.suite.id}@${record.suite.version}`;
    const key = `${suite}\u0000${tag}`;
    const group = groups.get(key) ?? {
      suite,
      tag,
      ...(record.implementation.package ? { pkg: record.implementation.package } : {}),
      byBrowser: new Map<string, ResultRecord>(),
    };
    groups.set(key, group);
    const previous = group.byBrowser.get(browser);
    if (!previous || previous.date < record.date) group.byBrowser.set(browser, record);
  }

  const verified: Record<string, number> = {};
  const failed: VerificationReport['failed'][number][] = [];
  const notExecuted: { tag: string; case: string }[] = [];
  const missing: { tag: string; browser: string }[] = [];
  const evidenced = new Set([...groups.values()].map((g) => g.tag));
  for (const tag of options.require ?? [])
    if (!evidenced.has(tag)) for (const browser of options.browsers) missing.push({ tag, browser });
  const entries = new Map<string, unknown[]>();
  for (const group of [...groups.values()].sort((a, b) =>
    a.tag === b.tag ? (a.suite < b.suite ? -1 : 1) : a.tag < b.tag ? -1 : 1,
  )) {
    const absent = options.browsers.filter((b) => !group.byBrowser.has(b));
    for (const browser of absent) missing.push({ tag: group.tag, browser });
    if (absent.length) continue;
    const used = options.browsers.map((b) => [b, group.byBrowser.get(b) as ResultRecord] as const);
    const cases = new Set(used.flatMap(([, r]) => r.results.map((x) => x.case)));
    const facts: string[] = [];
    for (const id of [...cases].sort()) {
      const outcomes = used.map(([browser, r]) => ({
        browser,
        result: r.results.find((x) => x.case === id),
      }));
      for (const { browser, result } of outcomes)
        if (result?.state === 'failed')
          failed.push({
            tag: group.tag,
            browser,
            case: id,
            ...(result.message ? { message: result.message } : {}),
          });
      if (outcomes.every((o) => o.result?.state === 'passed')) facts.push(id);
      else if (outcomes.some((o) => !o.result || o.result.state === 'not-executed'))
        notExecuted.push({ tag: group.tag, case: id });
    }
    if (!components[`component:${group.tag}`] || !facts.length) continue;
    verified[group.tag] = (verified[group.tag] ?? 0) + facts.length;
    const date = used.map(([, r]) => r.date).sort()[used.length - 1] as string;
    const list = entries.get(group.tag) ?? [];
    list.push({
      suite: group.suite,
      provenance: 'verified',
      source: { test: options.test, run: runId(group.suite, options.inputs), date },
      conditions: {
        browsers: used.map(([name, r]) => ({
          name,
          version: r.configuration['browserVersion'] ?? 'unknown',
        })),
        ...(group.pkg ? { package: group.pkg } : {}),
        inputs: sortedKeys(options.inputs),
      },
      facts,
    });
    entries.set(group.tag, list);
  }
  // Replace any earlier evidence: what is attached now is exactly what the current records show.
  for (const [id, component] of Object.entries(components)) {
    const tag = (component['tag'] as string | undefined) ?? id.replace(/^component:/, '');
    const { verification: _previous, ...rest } = component;
    const list = entries.get(tag);
    components[id] = list ? { ...rest, verification: list } : rest;
  }
  return {
    metadata: { ...metadata, components },
    report: { verified, failed, notExecuted, stale, missing },
  };
}
