// Runs tests/floor/probe.html in the installed floor browsers (scripts/compat/floor-browsers.mjs)
// and records the results in research/compatibility/floor-results.json (ADR 0038).
//
// The probe reports over HTTP, so no browser automation protocol is needed: each browser is
// started headless on the probe URL with a throwaway profile and stopped after it reports.
// Feature detections are compared with what @mdn/browser-compat-data predicts for that exact
// browser version. Usage: node scripts/compat/run-floor.mjs
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir, platform } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { supportAt, dataVersions, lookup, root } from './data.mjs';
import { FLOOR_BROWSERS, floorExecutable } from './floor-browsers.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function serve(onReport) {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'POST' && url.pathname === '/__report') {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        response.writeHead(204).end();
        onReport(JSON.parse(body));
      });
      return;
    }
    const path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root.replace(/[\\/]$/, '') + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = readFileSync(path);
      response.writeHead(200, {
        'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function launch(name, executable, url, profile) {
  if (name === 'chrome')
    return spawn(executable, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-component-update',
      `--user-data-dir=${profile}`,
      url,
    ]);
  writeFileSync(
    join(profile, 'user.js'),
    [
      'user_pref("browser.shell.checkDefaultBrowser", false);',
      'user_pref("browser.startup.homepage_override.mstone", "ignore");',
      'user_pref("browser.aboutwelcome.enabled", false);',
      'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
      'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
      'user_pref("app.update.disabledForTesting", true);',
      '',
    ].join('\n'),
  );
  return spawn(executable, ['--headless', '--no-remote', '--profile', profile, url]);
}

function stop(child) {
  if (child.exitCode !== null) return;
  if (platform() === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  else child.kill('SIGKILL');
}

/** Map a probe detection to the BCD key it tests. */
function detectionKey(detection) {
  const supports = /^\(([\w-]+):\s*([\w-]+)/.exec(detection);
  if (supports) {
    const value = `css.properties.${supports[1]}.${supports[2]}`;
    return lookup(value) ? value : `css.properties.${supports[1]}`;
  }
  const selector = /^selector\(::?([\w-]+)/.exec(detection);
  if (selector) return `css.selectors.${selector[1]}`;
  const parts = detection.split('.');
  const owner = parts[0] === 'window' ? 'Window' : parts[0];
  return `api.${owner}.${parts.at(-1)}`;
}

async function probe(name, version, server) {
  const executable = floorExecutable(name);
  if (!executable)
    return {
      browser: name,
      version,
      skipped: 'not installed (run node scripts/compat/floor-browsers.mjs)',
    };
  const { port } = server.address();
  const profile = mkdtempSync(join(tmpdir(), `oddkin-floor-${name}-`));
  let child;
  const report = new Promise((resolve, reject) => {
    server.pending = resolve;
    setTimeout(() => reject(new Error(`${name} ${version}: no report within 90 s`)), 90_000);
  });
  try {
    child = launch(
      name,
      executable,
      `http://127.0.0.1:${port}/tests/floor/probe.html?report`,
      profile,
    );
    return { browser: name, version, ...(await report) };
  } finally {
    if (child) stop(child);
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // A browser may hold profile files briefly after exit; the OS temp directory cleans up.
    }
  }
}

const server = await serve((result) => server.pending?.(result));
const registry = JSON.parse(readFileSync(join(root, 'docs/compatibility/features.json'), 'utf8'));
const runs = [];
let failed = false;
try {
  for (const name of ['chrome', 'firefox']) {
    const major = FLOOR_BROWSERS[name].version.split('.')[0];
    const run = await probe(name, FLOOR_BROWSERS[name].version, server);
    if (run.skipped) {
      console.log(`${FLOOR_BROWSERS[name].label}: skipped — ${run.skipped}`);
      runs.push(run);
      continue;
    }
    const failures = run.checks.filter((c) => !c.ok);
    failed ||= failures.length > 0;
    const mismatches = [];
    for (const [id, detected] of Object.entries(run.detections).sort(([a], [b]) =>
      a < b ? -1 : 1,
    )) {
      const [featureId, kind] = id.split(':');
      const feature = registry.features.find((f) => f.id === featureId);
      const detection = kind === 'css' ? feature.detectCss : feature.detectApi;
      const key = detectionKey(detection);
      const status = supportAt(key, name, major);
      if (status === 'unknown' || status === 'partial') continue;
      if ((status === 'full') !== detected)
        mismatches.push({ detection: id, key, bcd: status, detected });
    }
    runs.push({
      browser: name,
      version: FLOOR_BROWSERS[name].version,
      userAgent: run.userAgent,
      unsupportedSyntax: run.unsupportedSyntax,
      checks: run.checks,
      detections: run.detections,
      mismatches,
    });
    console.log(
      `${FLOOR_BROWSERS[name].label}: ${run.checks.length - failures.length}/${run.checks.length} checks passed; ${Object.keys(run.detections).length} detections, ${mismatches.length} differ from BCD.`,
    );
    for (const f of failures) console.log(`  FAIL ${f.id}: ${f.detail}`);
    for (const m of mismatches)
      console.log(`  data: ${m.detection} detected ${m.detected}, BCD ${m.key} says ${m.bcd}`);
  }
} finally {
  server.close();
}

mkdirSync(join(root, 'research/compatibility'), { recursive: true });
writeFileSync(
  join(root, 'research/compatibility/floor-results.json'),
  `${JSON.stringify(
    {
      note: 'Generated by scripts/compat/run-floor.mjs. Safari 18.2 is not covered: it cannot run on this host.',
      date: new Date().toISOString().slice(0, 10),
      host: `${platform()}`,
      data: {
        '@mdn/browser-compat-data': dataVersions.bcd,
        'web-features': dataVersions.webFeatures,
      },
      runs,
    },
    null,
    2,
  )}\n`,
);
if (failed) process.exit(1);
