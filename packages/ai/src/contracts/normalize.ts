/**
 * Validation and normalization at untrusted boundaries: host snapshots, adapter payloads, and
 * renderer data. Validation never trusts TypeScript declarations; normalization keeps only
 * declared fields (unknown keys become diagnostics) and replaces unsupported parts with an
 * explicit fallback instead of dropping or guessing.
 */
import type { ModelDiagnostic, Node } from '@oddkin/core/model';
import {
  ApprovalModel,
  ArtifactModel,
  ConversationSnapshotModel,
  MessageModel,
  ToolCallModel,
  partSchema,
} from './models.js';
import type {
  ApprovalRecord,
  ArtifactRecord,
  Capabilities,
  CapabilityName,
  ConversationSnapshot,
  MessagePart,
  MessageRecord,
  PublicError,
  ToolCallRecord,
} from './types.js';

export interface NormalizeDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface Normalized<T> {
  readonly ok: boolean;
  readonly value: T | undefined;
  readonly diagnostics: readonly NormalizeDiagnostic[];
}

/** Copy `value`, keeping only what `node` declares. Call after validation succeeded. */
export function pickDeclared(node: Node, value: unknown): unknown {
  switch (node.kind) {
    case 'optional':
      return value === undefined ? undefined : pickDeclared(node.inner as Node, value);
    case 'array':
      return (value as unknown[]).map((item) => pickDeclared(node.items as Node, item));
    case 'object':
      return pickShape(node.shape as Record<string, Node>, value as Record<string, unknown>);
    case 'union': {
      const record = value as Record<string, unknown>;
      const tag = record[node.discriminator] as string;
      const variant = (node.variants as Record<string, { shape: Record<string, Node> }>)[tag];
      return variant
        ? { [node.discriminator]: tag, ...pickShape(variant.shape, record) }
        : undefined;
    }
    case 'recursive':
      return pickDeclared(node.inner as Node, value);
    default:
      return value;
  }
}

function pickShape(shape: Record<string, Node>, value: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(shape)) {
    if (value[key] !== undefined) out[key] = pickDeclared(child, value[key]);
  }
  return out;
}

const PART_TYPES = new Set(Object.keys(partSchema.variants));

function toDiagnostics(
  items: readonly ModelDiagnostic[],
  prefix = '',
  strip = '',
): NormalizeDiagnostic[] {
  return items.map((d) => ({
    code: d.code,
    path: `${prefix}${strip && d.path.startsWith(strip) ? d.path.slice(strip.length) : d.path}`,
    message: d.message,
  }));
}

let fallbackIds = 0;

/**
 * Normalize one part. Unknown types and invalid known parts become `unsupported`, keeping the
 * original type for the fallback label; the content itself is never rendered.
 */
export function normalizePart(
  raw: unknown,
  path = '',
): { part: MessagePart; diagnostics: NormalizeDiagnostic[] } {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const type = typeof record['type'] === 'string' ? (record['type'] as string) : 'unknown';
  const id =
    typeof record['id'] === 'string' && record['id']
      ? (record['id'] as string)
      : `unsupported-${++fallbackIds}`;
  if (!PART_TYPES.has(type) || type === 'unsupported') {
    return {
      part: { type: 'unsupported', id, originalType: type },
      diagnostics: [
        { code: 'ai.part.unsupported', path, message: `Part type "${type}" is not supported.` },
      ],
    };
  }
  const variant = (partSchema.variants as Record<string, Node>)[type] as Node;
  const check = MessageModel.validate({ id: 'x', role: 'assistant', parts: [record] });
  const errors = check.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length) {
    return {
      part: { type: 'unsupported', id, originalType: type },
      diagnostics: [
        {
          code: 'ai.part.invalid',
          path,
          message: `Part "${type}" is invalid and is not rendered.`,
        },
        ...toDiagnostics(errors, path, '/parts/0'),
      ],
    };
  }
  const unknown = check.diagnostics.filter((d) => d.severity !== 'error');
  return {
    part: { type, ...(pickDeclared(variant, record) as object) } as MessagePart,
    diagnostics: toDiagnostics(unknown, path, '/parts/0'),
  };
}

/** Validate and normalize a message from an untrusted source. */
export function normalizeMessage(raw: unknown, path = ''): Normalized<MessageRecord> {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const diagnostics: NormalizeDiagnostic[] = [];
  const parts = Array.isArray(record['parts'])
    ? (record['parts'] as unknown[]).map((part, i) => {
        const result = normalizePart(part, `${path}/parts/${i}`);
        diagnostics.push(...result.diagnostics);
        return result.part;
      })
    : record['parts'];
  const candidate = { ...record, parts };
  const result = MessageModel.validate(candidate);
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  diagnostics.push(
    ...toDiagnostics(
      result.diagnostics.filter((d) => !d.path.includes('/parts/')),
      path,
    ),
  );
  if (errors.length) return { ok: false, value: undefined, diagnostics };
  return {
    ok: true,
    value: pickDeclared(MessageModel.schema, candidate) as MessageRecord,
    diagnostics,
  };
}

function normalizeRecord<T>(
  model: {
    schema: Node;
    validate(v: unknown): { ok: boolean; diagnostics: readonly ModelDiagnostic[] };
  },
  raw: unknown,
  path = '',
): Normalized<T> {
  const result = model.validate(raw);
  const diagnostics = toDiagnostics(result.diagnostics, path);
  return result.ok
    ? { ok: true, value: pickDeclared(model.schema, raw) as T, diagnostics }
    : { ok: false, value: undefined, diagnostics };
}

export const normalizeToolCall = (raw: unknown, path = ''): Normalized<ToolCallRecord> =>
  normalizeRecord(ToolCallModel, raw, path);
export const normalizeApproval = (raw: unknown, path = ''): Normalized<ApprovalRecord> =>
  normalizeRecord(ApprovalModel, raw, path);
export const normalizeArtifact = (raw: unknown, path = ''): Normalized<ArtifactRecord> =>
  normalizeRecord(ArtifactModel, raw, path);

/**
 * Validate a persisted conversation. Invalid messages fail the snapshot (their position in the
 * branch structure matters); unsupported parts inside valid messages are replaced.
 */
export function normalizeSnapshot(raw: unknown): Normalized<ConversationSnapshot> {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const diagnostics: NormalizeDiagnostic[] = [];
  let failed = false;
  const messages = Array.isArray(record['messages'])
    ? (record['messages'] as unknown[]).map((message, i) => {
        const result = normalizeMessage(message, `/messages/${i}`);
        diagnostics.push(...result.diagnostics);
        if (!result.ok) failed = true;
        return result.value ?? message;
      })
    : record['messages'];
  const candidate = { ...record, messages };
  const result = ConversationSnapshotModel.validate(candidate);
  diagnostics.push(
    ...toDiagnostics(result.diagnostics.filter((d) => !d.path.startsWith('/messages/'))),
  );
  if (failed || result.diagnostics.some((d) => d.severity === 'error'))
    return { ok: false, value: undefined, diagnostics };
  return {
    ok: true,
    value: pickDeclared(ConversationSnapshotModel.schema, candidate) as ConversationSnapshot,
    diagnostics,
  };
}

// ---- Capabilities ----

export const CAPABILITY_NAMES: readonly CapabilityName[] = [
  'send',
  'stop',
  'disconnect',
  'reconnect',
  'resume',
  'retry',
  'edit',
  'regenerate',
  'switchBranch',
  'respondToApproval',
  'editApproval',
  'restoreCheckpoint',
  'voice',
  'attachments',
  'history',
  'feedback',
];

/** Whether `name` is available. Absent capabilities are unavailable. */
export function can(capabilities: Capabilities | undefined, name: CapabilityName): boolean {
  return capabilities?.[name]?.available === true;
}

/** The host's reason for an unavailable capability, if one was supplied. */
export function unavailableReason(
  capabilities: Capabilities | undefined,
  name: CapabilityName,
): string | undefined {
  const entry = capabilities?.[name];
  return entry?.available ? undefined : entry?.reason;
}

/** Restrict `granted` to what `supported` allows: the application may narrow, never widen. */
export function intersectCapabilities(
  supported: Capabilities,
  granted: Capabilities,
): Capabilities {
  const out: Record<string, { available: boolean; reason?: string }> = {};
  for (const name of CAPABILITY_NAMES) {
    const s = supported[name];
    const g = granted[name];
    if (!s && !g) continue;
    const available = !!s?.available && (g ? g.available : true);
    const reason = !s?.available ? s?.reason : g && !g.available ? g.reason : undefined;
    out[name] = reason === undefined ? { available } : { available, reason };
  }
  return out as Capabilities;
}

// ---- Errors ----

/** Coerce a thrown value into a `PublicError` without leaking stack traces or internals. */
export function toPublicError(error: unknown, fallback: PublicError): PublicError {
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record['code'] === 'string' && typeof record['message'] === 'string') {
      const retryable = record['retryable'];
      return typeof retryable === 'boolean'
        ? { code: record['code'], message: record['message'], retryable }
        : { code: record['code'], message: record['message'] };
    }
  }
  return fallback;
}
