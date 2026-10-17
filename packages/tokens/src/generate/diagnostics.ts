/**
 * Structured diagnostics with JSON-pointer paths. Generation never throws for invalid
 * input; it returns diagnostics. Contract: theming-and-styling.md §2.
 */

export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  /** JSON pointer into the configuration (or `/tokens/<name>` for generated tokens). */
  readonly path: string;
  readonly message: string;
  readonly suggestion?: string;
}

export class DiagnosticList {
  readonly items: Diagnostic[] = [];

  error(code: string, path: string, message: string, suggestion?: string): void {
    this.items.push(
      suggestion
        ? { code, severity: 'error', path, message, suggestion }
        : { code, severity: 'error', path, message },
    );
  }

  warn(code: string, path: string, message: string, suggestion?: string): void {
    this.items.push(
      suggestion
        ? { code, severity: 'warning', path, message, suggestion }
        : { code, severity: 'warning', path, message },
    );
  }

  get hasErrors(): boolean {
    return this.items.some((d) => d.severity === 'error');
  }
}

/** Escape one JSON-pointer segment (RFC 6901). */
export function pointer(...segments: Array<string | number>): string {
  return segments.map((s) => `/${String(s).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');
}

/** Closest candidate by edit distance, for "did you mean" suggestions. */
export function closest(input: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const d = distance(input, candidate);
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }
  return best !== undefined && bestDistance <= Math.max(2, Math.floor(input.length / 3))
    ? best
    : undefined;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] as number;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j] as number;
      row[j] = Math.min(
        current + 1,
        (row[j - 1] as number) + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length] as number;
}
