export const RESPONSIVENESS_SOURCE: 'docs/architecture/responsiveness.md';
export const RESPONSIVENESS_ASSET: 'RESPONSIVENESS.md';
export function syncResponsiveness(
  root: string,
  options?: { check?: boolean },
): Promise<{ ok: boolean; changed: string[] }>;
