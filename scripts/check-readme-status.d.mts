export interface ReadmeFacts {
  packages: Record<string, { dir: string; version: string; peers: string[] }>;
  /** Every command a package's `bin` provides. */
  bins: string[];
  /** Element counts from `oddkin.metadata.json`, by package name. */
  counts: Record<string, number>;
  /** The browser floor from `docs/compatibility/features.json`, by browser id (`chrome`, `safari`). */
  floor: Record<string, string>;
}

export interface ReadmeProblem {
  line: number;
  message: string;
}

export declare function readFacts(root: string): ReadmeFacts;

/** `name` is the package the README documents; undefined for the root README. */
export declare function checkReadme(
  text: string,
  facts: ReadmeFacts,
  name: string | undefined,
): ReadmeProblem[];

export declare function readmes(
  root: string,
  facts: ReadmeFacts,
): { path: string; name: string | undefined }[];
