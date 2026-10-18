/**
 * URL policy for untrusted content (model output, tool output, source records). Allow-list of
 * schemes; relative references only when explicitly enabled. Returns undefined for anything
 * else, and the caller renders the text without a link. DOM-free.
 */
export interface UrlPolicy {
  /** Allowed schemes including the colon. */
  readonly protocols: readonly string[];
  /** Allow relative references (resolved against `base` when given). */
  readonly allowRelative: boolean;
  readonly base?: string | undefined;
}

export const DEFAULT_URL_POLICY: UrlPolicy = {
  protocols: ['https:', 'http:', 'mailto:'],
  allowRelative: false,
};

const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

/** The URL to use for `raw`, or undefined when the policy rejects it. */
export function safeUrl(raw: string, policy: UrlPolicy = DEFAULT_URL_POLICY): string | undefined {
  const value = raw.trim();
  if (!value || CONTROL.test(value)) return undefined;
  const scheme = SCHEME.exec(value);
  if (!scheme) {
    if (!policy.allowRelative || value.startsWith('//')) return undefined;
    if (!policy.base) return value;
    try {
      return new URL(value, policy.base).href;
    } catch {
      return undefined;
    }
  }
  const protocol = `${(scheme[1] as string).toLowerCase()}:`;
  if (!policy.protocols.includes(protocol)) return undefined;
  try {
    return new URL(value).href;
  } catch {
    return undefined;
  }
}

/** Host name for display ("example.com"), or undefined for non-network URLs. */
export function displayHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname;
    return host ? host.replace(/^www\./, '') : undefined;
  } catch {
    return undefined;
  }
}
