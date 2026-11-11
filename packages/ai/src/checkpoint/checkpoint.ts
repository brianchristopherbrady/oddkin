import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { can, unavailableReason } from '../contracts/normalize.js';
import type { Capabilities, CheckpointRecord } from '../contracts/types.js';
import { announceEvent, checkpointRestoreEvent } from '../events.js';
import { DecisionController } from '../internal/decision.js';
import { format, formatTime, langOf, strings } from '../internal/strings.js';

export const CHECKPOINT_STRINGS = {
  restores: 'Restoring replaces:',
  restore: 'Restore…',
  confirm: 'Restore this checkpoint',
  cancel: 'Keep current state',
  confirmText:
    'Restore to “{label}”? The items listed above are replaced. Work after this point is not kept unless the application saves it.',
  'restore-pending': 'Restoring… Not restored yet.',
  restored: 'Restored. {outcome}',
  'restore-failed': 'Restore failed: {message}',
  unavailable: 'This checkpoint cannot be restored.',
  changed: 'This checkpoint changed. Review what it replaces before restoring.',
  created: 'Created {time}',
  announceRestored: 'Checkpoint restored: {label}',
  announceFailed: 'Checkpoint restore failed: {label}',
  announceChanged: 'Checkpoint changed: {label}',
};

/** What a restore replaces, compared by content: hosts may pass a new array with the same items. */
const scopeOf = (c: CheckpointRecord): string => c.restores.join('\n');

/**
 * A restore point: what it restores, a confirmed restore request, pending work, and the outcome
 * the application confirms. Success is shown only when the record says `restored`. If the
 * checkpoint, or what it replaces, changes before the restore is asked, the confirmation closes
 * and says so (ADR 0049, page 14).
 *
 * @csspart base - The checkpoint surface.
 * @csspart restores - The list of state the restore replaces.
 * @csspart actions - Restore and confirmation controls.
 * @a11y A labelled group; restore needs an explicit confirmation step; status is text.
 * @keyboard Tab and Enter or Space; Restore… opens the confirmation with focus on Keep current state; when a focused control disappears, as when the confirmation closes because the checkpoint changed, focus moves to the outcome, or to Restore….
 * @useFor Restoring agent or editor state to an earlier point.
 * @notFor Undoing a single text edit; use the change review's undo.
 * @customization 1 2
 * @category AI
 */
export class OddkinCheckpoint extends OddkinElement.with({
  checkpoint: prop.object<CheckpointRecord>({ description: 'The checkpoint record.' }),
  capabilities: prop.object<Capabilities>({
    description: '`restoreCheckpoint` enables restoring.',
  }),
  announce: prop.enum(['none', 'important'], {
    default: 'none',
    empty: 'important',
    description: 'Announce outcomes (when no surrounding surface does).',
  }),
  strings: prop.object<Partial<typeof CHECKPOINT_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'odd-checkpoint-restore': checkpointRestoreEvent,
    'odd-announce': announceEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinCheckpoint>;

  /**
   * @internal The confirmation step (presentation state): the checkpoint, status, and scope it was
   * opened at. It shows while the record keeps them all, then while this view's request is in
   * flight.
   */
  readonly _confirming = signal<
    | {
        readonly id: string;
        readonly status: CheckpointRecord['status'];
        readonly scope: string;
      }
    | undefined
  >(undefined);
  /** @internal The checkpoint whose open confirmation closed because the record changed. */
  readonly _changed = signal<string | undefined>(undefined);
  /**
   * @internal Restore requested from this view for a checkpoint id; focus recovery. A vanished
   * control hands focus to the open confirmation's Keep current state, else to the outcome, or to
   * Restore….
   */
  readonly _decisions = new DecisionController(
    this,
    () =>
      this.shadowRoot?.querySelector<HTMLElement>('[data-action="cancel"]') ??
      this.shadowRoot?.querySelector<HTMLElement>('.outcome') ??
      this.shadowRoot?.querySelector<HTMLElement>('[data-action="restore"]'),
  );

  /** @internal */
  get _strings(): typeof CHECKPOINT_STRINGS {
    return strings(CHECKPOINT_STRINGS, this.strings);
  }

  /** @internal */
  get _unavailable(): string | undefined {
    const c = this.checkpoint;
    if (!c || c.status === 'unavailable') return this._strings.unavailable;
    if (!can(this.capabilities, 'restoreCheckpoint'))
      return unavailableReason(this.capabilities, 'restoreCheckpoint') ?? this._strings.unavailable;
    return undefined;
  }

  /** @internal */
  _created(): string | undefined {
    const time = formatTime(this.checkpoint?.createdAt, langOf(this));
    return time ? format(this._strings.created, { time }) : undefined;
  }

  /** @internal Whether a confirmation was opened for this record as it is now. */
  _matches(
    open: NonNullable<OddkinCheckpoint['_confirming']['value']>,
    c: CheckpointRecord,
  ): boolean {
    return open.id === c.checkpointId && open.status === c.status && open.scope === scopeOf(c);
  }

  /** @internal */
  readonly _ask = (): void => {
    const c = this.checkpoint;
    if (
      !c ||
      this._unavailable !== undefined ||
      c.status === 'restore-pending' ||
      this._decisions.asked(c.checkpointId)
    )
      return;
    this._changed.value = undefined;
    this._confirming.value = { id: c.checkpointId, status: c.status, scope: scopeOf(c) };
  };
  /** @internal */
  readonly _cancel = (): void => {
    this._confirming.value = undefined;
  };
  /** @internal The confirmation stays, its button loading, while the request is in flight. */
  readonly _restore = (): void => {
    const c = this.checkpoint;
    if (!c || this._unavailable !== undefined || this._decisions.asked(c.checkpointId)) return;
    if (c.status === 'restore-pending') return;
    // Only what was confirmed is restored: a confirmation the record has since changed asks nothing.
    const open = this._confirming.peek();
    if (!open || !this._matches(open, c)) return;
    this._confirming.value = undefined;
    this._decisions.request(c.checkpointId);
    this.emit(checkpointRestoreEvent, { checkpointId: c.checkpointId });
  };

  protected override mounted(scope: Scope): void {
    scope.use(this._decisions);
    let previous: CheckpointRecord['status'] | undefined;
    scope.effect(
      () => {
        const c = this.checkpoint;
        if (!c) return;
        this._decisions.settle(
          c.checkpointId,
          (c.status !== 'restore-pending' && c.status !== 'available') ||
            (c.status === 'available' && previous === 'restore-pending'),
        );
        // An open confirmation the record no longer matches closes for good. When the checkpoint
        // or what it replaces changed and it can still be restored, it says so; focus recovery
        // takes a focused Keep current state to Restore….
        const open = this._confirming.peek();
        if (open && !this._matches(open, c)) {
          this._confirming.value = undefined;
          if (
            (open.id !== c.checkpointId || open.scope !== scopeOf(c)) &&
            (c.status === 'available' || c.status === 'restore-failed') &&
            this._unavailable === undefined
          ) {
            this._changed.value = c.checkpointId;
            if (this.announce !== 'none')
              this.emit(announceEvent, {
                text: format(this._strings.announceChanged, { label: c.label }),
                priority: 'polite',
                key: `checkpoint:${c.checkpointId}:changed:${Date.now()}`,
              });
          }
        }
        if (
          this.announce !== 'none' &&
          previous &&
          previous !== c.status &&
          (c.status === 'restored' || c.status === 'restore-failed')
        ) {
          const t = this._strings;
          this.emit(announceEvent, {
            text: format(c.status === 'restored' ? t.announceRestored : t.announceFailed, {
              label: c.label,
            }),
            priority: 'polite',
            key: `checkpoint:${c.checkpointId}:${c.status}:${Date.now()}`,
          });
        }
        previous = c.status;
      },
      { phase: 'post', name: '<odd-checkpoint> status' },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-checkpoint': OddkinCheckpoint;
  }
}
