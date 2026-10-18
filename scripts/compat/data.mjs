// Shared compatibility-data helpers for Oddkin's CSS and platform support policy (ADR 0038).
// Development tooling only: @mdn/browser-compat-data and web-features are pinned dev
// dependencies and never reach shipped code.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const root = fileURLToPath(new URL('../..', import.meta.url));

export const bcd = require('@mdn/browser-compat-data');
export const { features: webFeatures } = await import('web-features');

const versionOf = (name) =>
  JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
export const dataVersions = {
  bcd: bcd.__meta?.version ?? versionOf('@mdn/browser-compat-data'),
  webFeatures: versionOf('web-features'),
};

/** Desktop and mobile browsers in the support floor, with readable labels. */
export const BROWSERS = {
  chrome: 'Chrome',
  chrome_android: 'Chrome Android',
  edge: 'Edge',
  firefox: 'Firefox',
  firefox_android: 'Firefox Android',
  safari: 'Safari',
  safari_ios: 'Safari iOS',
};
export const DESKTOP = ['chrome', 'edge', 'firefox', 'safari'];

export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** The `__compat` record for a dotted BCD key, or undefined. */
export function lookup(key) {
  let node = bcd;
  for (const part of key.split('.')) {
    node = node?.[part];
    if (node === undefined) return undefined;
  }
  return node?.__compat;
}

/** Sub-keys of a BCD key (e.g. value keywords of a property). */
export function children(key) {
  let node = bcd;
  for (const part of key.split('.')) node = node?.[part];
  return node ? Object.keys(node).filter((k) => k !== '__compat') : [];
}

function cleanVersion(value) {
  if (value === true) return '0';
  if (typeof value !== 'string' || value === 'preview') return undefined;
  return value.replace(/^≤/, '');
}

/**
 * First versions with full and with partial support in one browser (for reporting).
 * Statements behind flags, prefixes, or alternative names do not count; removed full
 * support does not count as current support.
 */
export function firstSupport(key, browser) {
  const compat = lookup(key);
  if (!compat) return undefined;
  let full;
  let partial;
  for (const s of statements(compat, browser)) {
    if (s.flags || s.prefix || s.alternative_name) continue;
    const version = cleanVersion(s.version_added);
    if (version === undefined) continue;
    if (s.partial_implementation) {
      if (partial === undefined || compareVersions(version, partial) < 0) partial = version;
    } else if (!s.version_removed && (full === undefined || compareVersions(version, full) < 0))
      full = version;
  }
  return { full, partial };
}

function statements(compat, browser) {
  const raw = compat.support?.[browser];
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

/**
 * 'full' | 'partial' | 'none' for a key in one browser version ('unknown' without data).
 * Each statement applies from `version_added` until `version_removed`.
 */
export function supportAt(key, browser, version) {
  const compat = lookup(key);
  if (!compat) return 'unknown';
  let status = 'none';
  for (const s of statements(compat, browser)) {
    if (s.flags || s.prefix || s.alternative_name) continue;
    const added = cleanVersion(s.version_added);
    if (added === undefined || compareVersions(added, version) > 0) continue;
    const removed = cleanVersion(s.version_removed);
    if (removed !== undefined && compareVersions(version, removed) >= 0) continue;
    if (!s.partial_implementation) return 'full';
    status = 'partial';
  }
  return status;
}

/** Support of a key in every floor browser: { browser: { status, full, partial } }. */
export function floorSupport(key, floor) {
  const out = {};
  for (const [browser, version] of Object.entries(floor)) {
    const first = firstSupport(key, browser) ?? {};
    out[browser] = { status: supportAt(key, browser, version), ...first };
  }
  return out;
}

/** True when every floor browser fully supports the key. */
export function atFloor(key, floor) {
  return Object.values(floorSupport(key, floor)).every((s) => s.status === 'full');
}

/** web-features id that lists a BCD key, if any. */
const featureByKey = new Map();
for (const [id, feature] of Object.entries(webFeatures)) {
  for (const key of feature.compat_features ?? [])
    if (!featureByKey.has(key)) featureByKey.set(key, id);
}
export function webFeatureFor(key) {
  return featureByKey.get(key);
}

/** Baseline status of a web-features feature: { baseline, low, high }. */
export function baselineOf(id) {
  const status = webFeatures[id]?.status;
  if (!status) return undefined;
  return {
    baseline: status.baseline,
    low: status.baseline_low_date,
    high: status.baseline_high_date,
  };
}

/**
 * Minimum version per core browser that supports every feature Baseline Widely Available on
 * `date` (YYYY-MM-DD), from web-features' per-feature support data.
 */
export function widelyAvailableVersions(date) {
  const out = {};
  for (const feature of Object.values(webFeatures)) {
    const status = feature.status;
    if (status?.baseline !== 'high' || !status.baseline_high_date) continue;
    if (status.baseline_high_date.replace(/^≤/, '') > date) continue;
    for (const [browser, version] of Object.entries(status.support ?? {})) {
      const clean = String(version).replace(/^≤/, '');
      if (!out[browser] || compareVersions(clean, out[browser]) > 0) out[browser] = clean;
    }
  }
  return out;
}

/** Release date of a browser version from BCD, if recorded. */
export function releaseDate(browser, version) {
  return bcd.browsers?.[browser]?.releases?.[version]?.release_date;
}
