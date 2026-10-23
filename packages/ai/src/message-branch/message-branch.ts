import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { can, unavailableReason } from '../contracts/normalize.js';
import type { BranchPosition, Capabilities } from '../contracts/types.js';
import { branchSwitchEvent } from '../events.js';
import { strings } from '../internal/strings.js';

export const MESSAGE_BRANCH_STRINGS = {
  label: 'Versions',
  previous: 'Previous version',
  next: 'Next version',
  position: 'Version {index} of {count}',
};

/**
 * Navigate between alternative versions of a message (regenerated answers, edited prompts).
 * Every version stays in history; switching only changes which branch is shown.
 *
 * @csspart base - The navigation group.
 * @a11y A labelled group with previous/next buttons and a text position ("Version 2 of 3").
 * @keyboard Tab to the buttons; Enter or Space switches.
 * @useFor Alternative responses and edited prompts.
 * @notFor Pagination of unrelated content.
 * @category AI
 */
export class OddkinMessageBranch extends OddkinElement.with({
  messageId: prop.string({
    default: '',
    attribute: 'message-id',
    description: 'The message shown now.',
  }),
  branch: prop.object<BranchPosition>({ description: 'Position among sibling versions.' }),
  capabilities: prop.object<Capabilities>({ description: '`switchBranch` enables navigation.' }),
  strings: prop.object<Partial<typeof MESSAGE_BRANCH_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = { 'odd-branch-switch': branchSwitchEvent };
  declare readonly _events?: ElementEvents<typeof OddkinMessageBranch>;

  /** @internal */
  get _strings(): typeof MESSAGE_BRANCH_STRINGS {
    return strings(MESSAGE_BRANCH_STRINGS, this.strings);
  }

  /** @internal Why switching is unavailable, if it is. */
  get _unavailable(): string | undefined {
    return can(this.capabilities, 'switchBranch')
      ? undefined
      : (unavailableReason(this.capabilities, 'switchBranch') ?? '');
  }

  /** @internal */
  readonly _go = (event: Event): void => {
    const direction = (event.currentTarget as HTMLElement).dataset['direction'];
    const target = direction === 'previous' ? this.branch?.previousId : this.branch?.nextId;
    if (target && this._unavailable === undefined)
      this.emit(branchSwitchEvent, { messageId: this.messageId, targetMessageId: target });
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-message-branch': OddkinMessageBranch;
  }
}
