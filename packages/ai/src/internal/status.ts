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
