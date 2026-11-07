export interface RegisterFamily {
  name: string;
  tokens: string[];
  purpose: string;
}

export interface TokenRegister {
  families: RegisterFamily[];
  /** Role tokens no shipped CSS reads, offered to consumers, with the reason. */
  offered: Record<string, string>;
}

/** A token as the default theme's inspection JSON lists it. */
export interface InspectedToken {
  name: string;
  cssVariable: string;
  category: string;
  type: string;
  origin: string;
  definition: unknown;
  description?: string;
}

export function loadRegister(): TokenRegister;
export function loadInspection(): { tokens: InspectedToken[] };
export function loadDocumented(): Set<string>;
export function familyOf(register: TokenRegister, name: string): RegisterFamily | undefined;
export function checkRegister(
  register: TokenRegister,
  tokens: readonly InspectedToken[],
  read: ReadonlySet<string>,
): string[];
export function checkCss(
  text: string,
  options: {
    file: string;
    tokensByVariable: ReadonlyMap<string, InspectedToken>;
    documented: ReadonlySet<string>;
  },
): { problems: string[]; used: Set<string> };
export function run(): Promise<{
  problems: string[];
  tokens: number;
  sheets: number;
  used: number;
}>;
