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
  /** @deprecated Unused: a checkpoint that can be restored shows no status. Removed at the next major release. */
  available: 'Available',
  'restore-pending': 'Restoring… Not restored yet.',
  restored: 'Restored. {outcome}',
  'restore-failed': 'Restore failed: {message}',
  unavailable: 'This checkpoint cannot be restored.',
  created: 'Created {time}',
  announceRestored: 'Checkpoint restored: {label}',
  announceFailed: 'Checkpoint restore failed: {label}',
};

/**
 * A restore point: what it restores, a confirmed restore request, pending work, and the outcome
 * the application confirms. Success is shown only when the record says `restored`.
 *
 * @csspart base - The checkpoint surface.
 * @csspart restores - The list of state the restore replaces.
 * @csspart actions - Restore and confirmation controls.
 * @a11y A labelled group; restore needs an explicit confirmation step; status is text.
 * @keyboard Tab and Enter or Space; when controls disappear, focus moves to the confirmation, or back to the status (to Restore… when no status shows).
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
    description: 'Localized string overrides; `available` is unused (deprecated).',
  }),
}) {
  static override events = {
    'odd-checkpoint-restore': checkpointRestoreEvent,
    'odd-announce': announceEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinCheckpoint>;

  /** @internal Confirmation step (presentation state). */
  readonly _confirming = signal(false);
  /**
   * @internal Restore requested from this view for a checkpoint id; focus recovery. While
   * confirming, a vanished control hands focus to the confirmation, else to the status, or to
   * Restore… when there is no status.
   */
  readonly _decisions = new DecisionController(
    this,
    () =>
      (this._confirming.peek()
        ? this.shadowRoot?.querySelector<HTMLElement>('[data-confirm]')
        : undefined) ??
      this.shadowRoot?.querySelector<HTMLElement>('.state:not([hidden])') ??
      this.shadowRoot?.querySelector<HTMLElement>('[part="actions"] odd-button'),
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

  /** @internal */
  readonly _ask = (): void => {
    if (this._unavailable === undefined) this._confirming.value = true;
  };
  /** @internal */
  readonly _cancel = (): void => {
    this._confirming.value = false;
  };
  /** @internal */
  readonly _restore = (): void => {
    const c = this.checkpoint;
    if (!c || this._unavailable !== undefined || this._decisions.asked(c.checkpointId)) return;
    if (c.status === 'restore-pending') return;
    this._confirming.value = false;
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
