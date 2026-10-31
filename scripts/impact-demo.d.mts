export interface DemonstrationEdit {
  /** Repository-relative path. */
  readonly file: string;
  /** Text that occurs exactly once in the file. */
  readonly find: string;
  readonly replace: string;
}

/** The demonstration's commits, in order. */
export declare const CHANGE: readonly {
  readonly message: string;
  readonly edits: readonly DemonstrationEdit[];
}[];

/** Apply `edits` to the texts `read(file)` returns; the edited texts by file. */
export declare function applyEdits(
  read: (file: string) => string,
  edits: readonly DemonstrationEdit[],
): Map<string, string>;
