/** Diagnostics shared by the DOM-free Workbench entries. */
export interface WorkbenchDiagnostic {
  /** Stable code, e.g. `config.key.unknown`. */
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  /** JSON pointer or id the diagnostic is about. */
  readonly path?: string;
}

export class DiagnosticList {
  readonly items: WorkbenchDiagnostic[] = [];
  error(code: string, message: string, path?: string): void {
    this.items.push({ code, severity: 'error', message, ...(path === undefined ? {} : { path }) });
  }
  warn(code: string, message: string, path?: string): void {
    this.items.push({
      code,
      severity: 'warning',
      message,
      ...(path === undefined ? {} : { path }),
    });
  }
  get hasErrors(): boolean {
    return this.items.some((d) => d.severity === 'error');
  }
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
