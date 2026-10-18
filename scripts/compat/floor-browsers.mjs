// Installs the pinned floor browsers (ADR 0009, ADR 0038) into a cache directory outside the
// repository so compatibility probes can run in named older releases:
//   Chrome for Testing 125.0.6422.141 and Firefox 126.0 (win64 and linux64).
// Safari 17.4 cannot be installed this way; its coverage is recorded as a gap.
// Usage: node scripts/compat/floor-browsers.mjs [--force]
import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { arch, homedir, platform } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

export const FLOOR_BROWSERS = {
  chrome: { version: '125.0.6422.141', label: 'Chrome for Testing 125.0.6422.141' },
  firefox: { version: '126.0', label: 'Firefox 126.0' },
};

export function cacheDir() {
  if (process.env.ODDKIN_BROWSER_CACHE) return process.env.ODDKIN_BROWSER_CACHE;
  return platform() === 'win32'
    ? join(process.env.LOCALAPPDATA ?? homedir(), 'oddkin', 'floor-browsers')
    : join(homedir(), '.cache', 'oddkin', 'floor-browsers');
}

export function hostTarget() {
  if (arch() !== 'x64') return undefined;
  if (platform() === 'win32') return 'win64';
  if (platform() === 'linux') return 'linux64';
  return undefined;
}

function sources(target) {
  const chrome = FLOOR_BROWSERS.chrome.version;
  const firefox = FLOOR_BROWSERS.firefox.version;
  const cft = `https://storage.googleapis.com/chrome-for-testing-public/${chrome}/${target}/chrome-${target}.zip`;
  return target === 'win64'
    ? {
        chrome: { url: cft, file: 'chrome.zip', executable: ['chrome-win64', 'chrome.exe'] },
        firefox: {
          url: `https://archive.mozilla.org/pub/firefox/releases/${firefox}/win64/en-US/Firefox%20Setup%20${firefox}.exe`,
          file: 'firefox-setup.exe',
          executable: ['core', 'firefox.exe'],
        },
      }
    : {
        chrome: { url: cft, file: 'chrome.zip', executable: ['chrome-linux64', 'chrome'] },
        firefox: {
          url: `https://archive.mozilla.org/pub/firefox/releases/${firefox}/linux-x86_64/en-US/firefox-${firefox}.tar.bz2`,
          file: 'firefox.tar.bz2',
          executable: ['firefox', 'firefox'],
        },
      };
}

/** Absolute path of an installed floor browser, or undefined when it is not installed. */
export function floorExecutable(name) {
  const target = hostTarget();
  if (!target) return undefined;
  const dir = join(cacheDir(), `${name}-${FLOOR_BROWSERS[name].version}`);
  const path = join(dir, ...sources(target)[name].executable);
  return existsSync(path) ? path : undefined;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
}

async function download(url, file) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`GET ${url}: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
}

async function writePolicies(dir) {
  // Keep the pinned version: never update from inside a test run.
  await mkdir(join(dir, 'distribution'), { recursive: true });
  await writeFile(
    join(dir, 'distribution', 'policies.json'),
    `${JSON.stringify({ policies: { DisableAppUpdate: true } }, null, 2)}\n`,
  );
}

async function install(name, target, force) {
  const source = sources(target)[name];
  const dir = join(cacheDir(), `${name}-${FLOOR_BROWSERS[name].version}`);
  const executable = join(dir, ...source.executable);
  if (existsSync(executable) && !force) {
    console.log(`${FLOOR_BROWSERS[name].label}: already installed at ${executable}`);
    return;
  }
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const archive = join(dir, source.file);
  console.log(`${FLOOR_BROWSERS[name].label}: downloading ${source.url}`);
  await download(source.url, archive);
  if (name === 'chrome') {
    // bsdtar (bundled with Windows 10+) extracts zip archives; Linux uses unzip.
    if (target === 'win64') {
      run('tar', ['-xf', source.file], dir);
      // Chrome's sandbox runs as an AppContainer and must be able to read the executable:
      // grant read/execute to ALL APPLICATION PACKAGES instead of disabling the sandbox.
      run('icacls', [dir, '/grant', '*S-1-15-2-1:(OI)(CI)(RX)', '/T', '/Q'], dir);
    } else run('unzip', ['-q', source.file], dir);
  } else if (target === 'win64') {
    // The full installer extracts without installing or touching the registry.
    run(archive, [`/ExtractDir=${dir}`], dir);
    await writePolicies(join(dir, 'core'));
  } else {
    run('tar', ['-xjf', source.file], dir);
    await writePolicies(join(dir, 'firefox'));
  }
  await rm(archive, { force: true });
  if (!existsSync(executable)) throw new Error(`${name}: ${executable} missing after extraction`);
  console.log(`${FLOOR_BROWSERS[name].label}: installed at ${executable}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const target = hostTarget();
  if (!target) {
    console.error(
      `Floor browsers are automated for win64 and linux64 only (this host: ${platform()}-${arch()}).`,
    );
    process.exit(2);
  }
  const force = process.argv.includes('--force');
  for (const name of ['chrome', 'firefox']) await install(name, target, force);
}
