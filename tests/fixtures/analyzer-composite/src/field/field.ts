import { OddkinElement, prop } from '@oddkin/core';

/** A labelled text field. */
export class AcmeField extends OddkinElement.with({
  label: prop.string({ default: '' }),
  value: prop.string({ default: '' }),
}) {}

/** A small action button. */
export class AcmeButton extends OddkinElement.with({ disabled: prop.boolean() }) {}
