/**
 * Source history for `docs[*].updated`: the date of the last commit touching a page's declared
 * source files. Never build time; without history, dates are omitted
 * (metadata-and-analyzer.md §3, "Updated dates").
 */
import { execFileSync } from 'node:child_process';
import { relative, resolve, sep } from 'node:path';

export interface SourceHistory {
  /** The last commit date (`YYYY-MM-DD`) of each file that has one, keyed by the path given. */
  lastChanged(files: readonly string[]): ReadonlyMap<string, string>;
}

const CHUNK = 200;

/**
 * History from the git repository containing `root`; `undefined` when git or the repository is
 * unavailable, or the clone is shallow (its oldest commit would pose as the last change).
 */
export function gitHistory(root: string): SourceHistory | undefined {
  const git = (cwd: string, args: readonly string[]) =>
    execFileSync('git', ['-c', 'core.quotePath=false', '--literal-pathspecs', ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  let top: string;
  try {
    if (git(root, ['rev-parse', '--is-shallow-repository']).trim() !== 'false') return undefined;
    top = git(root, ['rev-parse', '--show-toplevel']).trim();
  } catch {
    return undefined;
  }
  return {
    lastChanged(files) {
      const byPath = new Map<string, string>();
      for (const file of files) {
        const path = relative(top, resolve(root, file)).split(sep).join('/');
        if (path && !path.startsWith('..')) byPath.set(path, file);
      }
      const dates = new Map<string, string>();
      const paths = [...byPath.keys()];
      for (let i = 0; i < paths.length; i += CHUNK) {
        const output = git(top, [
          'log',
          '--format=@@%cI',
          '--name-only',
          '--',
          ...paths.slice(i, i + CHUNK),
        ]);
        let date = '';
        for (const line of output.split('\n')) {
          if (line.startsWith('@@')) date = line.slice(2, 12);
          else {
            const file = byPath.get(line.trim());
            if (file && date > (dates.get(file) ?? '')) dates.set(file, date);
          }
        }
      }
      return dates;
    },
  };
}
