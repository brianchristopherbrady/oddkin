/**
 * Focus recovery when a control that has focus disappears after an update (for example decision
 * buttons hidden once a decision is recorded). Moves focus to `fallback` (made programmatically
 * focusable) so keyboard users keep their place; never moves focus otherwise.
 */
export function recoverFocus(
  root: ShadowRoot | null | undefined,
  fallback: HTMLElement | null | undefined,
): void {
  const active = root?.activeElement as HTMLElement | null | undefined;
  if (!root || !active || !fallback) return;
  if (!active.closest('[hidden]') && !(active as { disabled?: boolean }).disabled) return;
  if (!fallback.hasAttribute('tabindex')) fallback.tabIndex = -1;
  fallback.focus({ preventScroll: true });
}
