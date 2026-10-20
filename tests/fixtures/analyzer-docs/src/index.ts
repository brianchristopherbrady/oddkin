import { OddkinElement, compose, define } from '@oddkin/core';

// Analysis must never execute library modules.
throw new Error('analysis executed the dated module');

/**
 * Its page shows an authored date, whatever the source history says.
 *
 * @updated 2026-03-14
 */
export class AcmeDated extends OddkinElement {}

/**
 * February has no 30th: the date is reported and the page falls back to source history.
 *
 * @updated 2026-02-30
 */
export class AcmeMisdated extends OddkinElement {}

define(compose({ name: 'acme-dated', element: AcmeDated }));
define(compose({ name: 'acme-misdated', element: AcmeMisdated }));
