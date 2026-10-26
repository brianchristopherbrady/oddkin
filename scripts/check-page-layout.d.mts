export interface PageLayoutException {
  file: string;
  /** The rule's selector text, or `*` for every rule in the file. */
  selector: string;
  reason: string;
}

export interface PageLayout {
  selector: string;
  line: number;
  declaration: string;
}

export interface PageLayoutFinding extends PageLayout {
  file: string;
  exception: PageLayoutException | undefined;
}

export interface PageLayoutResult {
  files: number;
  findings: PageLayoutFinding[];
  unlisted: PageLayoutFinding[];
  stale: PageLayoutException[];
}

export declare const SOURCES: {
  directories: string[];
  extensions: string[];
  skip: string[];
  files: string[];
};
export declare const EXCEPTIONS: PageLayoutException[];
export declare function findLayouts(text: string): PageLayout[];
export declare function checkPages(options?: {
  base?: string;
  files?: string[];
  read?: (file: string) => string;
  exceptions?: PageLayoutException[];
}): PageLayoutResult;
