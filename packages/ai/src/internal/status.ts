import { html } from '@oddkin/core/template';

/**
 * One map from a status to its tone, shared by the agent workflow elements that colour their
 * status (ADR 0049 §4): `success` once done as asked, `danger` once failed or refused, `active`
 * while in progress; any other status is neutral (no tone).
 */
const TONES: Readonly<Record<string, string>> = {
  approved: 'success',
  restored: 'success',
  'output-available': 'success',
  failed: 'danger',
  rejected: 'danger',
  denied: 'danger',
  'output-error': 'danger',
  'restore-failed': 'danger',
  submitting: 'active',
  waiting: 'active',
  executing: 'active',
  'input-streaming': 'active',
  'restore-pending': 'active',
};

/** The tone of a status, or `''` for a neutral one. */
export const toneOf = (status: string): string => TONES[status] ?? '';

const ATTENTION = new Set(['requested', 'expired', 'needs-input']);
const BADGE_TONES: Readonly<Record<string, string>> = {
  success: 'success',
  danger: 'danger',
  active: 'info',
};

/**
 * The status part's compact form (Figma page 08, `Oddkin/AI/Internal/Status`): an `odd-badge`
 * naming the state. A request waiting for the person, an expired one, and needed input are marked
 * for attention; the outcome line beside it keeps neutral wording.
 */
export const statusBadge = (status: string, label: string) =>
  html`<odd-badge
    class="status-badge"
    tone=${ATTENTION.has(status) ? 'warning' : (BADGE_TONES[toneOf(status)] ?? 'neutral')}
    >${label}</odd-badge
  >`;
