#!/usr/bin/env node
// Records a share link made by a published Workbench (IMPLEMENTATION_PLAN.md P0.2; release-process.md
// §1), for later Workbench versions to be tested against:
//
//   node scripts/workbench-share-fixture.mjs [--version 1.0.0-beta.1] [--port 4291]
//
// Installs @oddkin/workbench and @oddkin/components at that version from npm into a new directory
// outside the workspace, starts that Workbench's dev server, edits odd-button's preview in
// Chromium, presses "Copy example link", and writes the link, its decoded payload, and how it was
// made to packages/workbench/test/fixtures/share-<version>.json.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const option = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const VERSION = option('--version', '1.0.0-beta.1');
const PORT = Number(option('--port', '4291'));
// The published Workbench and every Oddkin package it brings, pinned to the one version.
const PACKAGES = ['workbench', 'components', 'core', 'tokens', 'analyzer', 'app', 'state'];
const out = join(root, 'packages/workbench/test/fixtures', `share-${VERSION}.json`);

const dir = mkdtempSync(join(tmpdir(), 'oddkin-share-'));
let server;
try {
  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify({ name: 'share-link', private: true, type: 'module' }, null, 2)}\n`,
  );
  writeFileSync(
    join(dir, 'oddkin.config.mjs'),
    "export default { library: { packages: ['@oddkin/components'] } };\n",
  );
  const install = spawnSync(
    'npm',
    ['install', '--no-audit', '--no-fund', ...PACKAGES.map((p) => `@oddkin/${p}@${VERSION}`)],
    { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (install.status !== 0) throw new Error(`npm install failed in ${dir}`);
  const installed = Object.fromEntries(
    PACKAGES.map((p) => [
      `@oddkin/${p}`,
      JSON.parse(readFileSync(join(dir, 'node_modules/@oddkin', p, 'package.json'), 'utf8'))
        .version,
    ]),
  );
  for (const [name, version] of Object.entries(installed))
    if (version !== VERSION) throw new Error(`${name} ${version} installed, not ${VERSION}`);

  const bin = join(dir, 'node_modules/@oddkin/workbench/dist/node/bin.js');
  server = spawn(
    process.execPath,
    [bin, 'workbench', 'dev', '--port', String(PORT), '--host', '127.0.0.1'],
    { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  server.stdout.on('data', (chunk) => (output += chunk));
  server.stderr.on('data', (chunk) => (output += chunk));
  const origin = `http://127.0.0.1:${PORT}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    const ok = await fetch(`${origin}/`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) break;
    if (server.exitCode !== null || Date.now() > deadline)
      throw new Error(`The ${VERSION} dev server did not start:\n${output}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const browser = await chromium.launch();
  let link;
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/components/odd-button`);
    const preview = page.frameLocator('oddkin-workbench-component iframe').first();
    await preview.locator('odd-button').filter({ hasText: 'Save' }).waitFor({ timeout: 60_000 });
    await page.getByRole('combobox', { name: 'appearance (attribute)' }).selectOption('ghost');
    await page.getByLabel('default slot text').fill('Publish');
    await page
      .locator('tr[data-css="--odd-button-background"]')
      .getByRole('textbox')
      .fill('rgb(1, 2, 3)');
    // A select's name includes its selected option, so these match the label's start.
    await page.getByRole('combobox', { name: /^Mode/ }).selectOption('dark');
    await page.getByRole('combobox', { name: /^Direction/ }).selectOption('rtl');
    await page.getByRole('combobox', { name: /^Width/ }).selectOption('custom');
    const width = page.getByRole('spinbutton', { name: /^Width in px/ });
    await width.fill('360');
    await width.press('Tab');
    await page.getByRole('button', { name: 'Copy example link' }).click();
    link = await page.locator('input[type="url"]').inputValue();
  } finally {
    await browser.close();
  }

  const encoded = new URL(link).searchParams.get('preview');
  if (!encoded) throw new Error(`The copied link has no preview parameter: ${link}`);
  const record = {
    made: {
      by: `@oddkin/workbench@${VERSION}`,
      packages: installed,
      from: 'npm, installed into a new directory outside the workspace',
      with: 'scripts/workbench-share-fixture.mjs',
      steps: [
        `oddkin workbench dev on a project documenting @oddkin/components@${VERSION}`,
        'components/odd-button: appearance (attribute) ghost, default slot text "Publish", --odd-button-background rgb(1, 2, 3)',
        'preview settings: Mode Dark, Direction Right to left, Width Custom 360',
        'Copy example link',
      ],
      date: new Date().toISOString().slice(0, 10),
    },
    link,
    payload: JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')),
  };
  writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Wrote ${out}\n${link}`);
} finally {
  server?.kill();
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
