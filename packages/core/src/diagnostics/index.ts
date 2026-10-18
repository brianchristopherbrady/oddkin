/**
 * Shared diagnostics for Oddkin packages. DOM-free.
 *
 * Every Oddkin error carries a stable `code` so documentation, tests, and tooling
 * can refer to it. Errors that cannot be thrown to a caller (for example, an
 * effect failing during a scheduled flush) go to one configurable handler.
 */

/** An error raised by Oddkin with a stable, documented code. */
export class OddkinError extends Error {
  readonly code: string;

  /**
   * @param message Development explanation. Production builds pass `''` and keep only the
   * stable code, so failures stay identifiable without shipping every message.
   */
  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(
      `[${code}] ${message || 'Use the development build (the "development" export condition) for details.'}`,
      options,
    );
    this.name = 'OddkinError';
    this.code = code;
  }
}

/** Where an asynchronously reported error came from. */
export interface ErrorContext {
  /** Stable code describing the failure, e.g. `reactive.effect.error`. */
  code: string;
  /** Optional name of the effect, computed value, or owner involved. */
  origin?: string | undefined;
}

export type ErrorHandler = (error: unknown, context: ErrorContext) => void;

const defaultHandler: ErrorHandler = (error, context) => {
  const report = (globalThis as { reportError?: (error: unknown) => void }).reportError;
  if (typeof report === 'function') report(error);
  else
    console.error(`Oddkin ${context.code}${context.origin ? ` in ${context.origin}` : ''}:`, error);
};

let handler: ErrorHandler = defaultHandler;

/**
 * Replace the handler for errors that cannot be thrown to a caller.
 * Pass `undefined` to restore the default. Returns the previous handler.
 */
export function setErrorHandler(next: ErrorHandler | undefined): ErrorHandler {
  const previous = handler;
  handler = next ?? defaultHandler;
  return previous;
}

/** Report an error through the configured handler. Never throws. */
export function reportOddkinError(error: unknown, context: ErrorContext): void {
  try {
    handler(error, context);
  } catch (handlerError) {
    console.error('Oddkin error handler failed:', handlerError, 'while reporting:', error);
  }
}
