import { OddkinElement, prop } from '@oddkin/core';

export interface Member {
  readonly id: string;
  readonly name: string;
}

/** Keyed member rows; each row renders the definition's field and button roles. */
export class AcmeRows extends OddkinElement.with({
  members: prop.array<Member>({ description: 'Rows, keyed by `id`.' }),
}) {}
