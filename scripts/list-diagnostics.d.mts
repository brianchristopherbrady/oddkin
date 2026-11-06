export interface Diagnostic {
  code: string;
  /** `error`, `warning`, or `info`; empty when the source does not say. */
  severity: string;
  /** Empty when the message is computed at run time. */
  message: string;
  suggestion?: string;
  line: number;
}

export interface ListedDiagnostic extends Diagnostic {
  package: string;
  file: string;
  /** Whether the message names what to do; null when it is computed and reviewed by hand. */
  action: boolean | null;
}

export declare function namesAnAction(text: string): boolean;

/** `text` with each run-time value (`${…}`, nested or not, and `{name}`) replaced by `x`. */
export declare function withoutValues(text: string): string;

export declare function extractDiagnostics(source: string, file?: string): Diagnostic[];

export declare function listDiagnostics(base?: string): ListedDiagnostic[];

export declare function renderDiagnostics(list: ListedDiagnostic[]): string;
