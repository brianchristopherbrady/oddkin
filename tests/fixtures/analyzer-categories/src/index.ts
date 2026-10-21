import { OddkinElement, compose, define } from '@oddkin/core';

/**
 * Sets the label of its category: first in tag order.
 *
 * @category Layout tools
 */
export class AcmeGrid extends OddkinElement {}

/**
 * The same category spelled differently: reported, and grouped under "Layout tools".
 *
 * @category layout Tools
 */
export class AcmeStack extends OddkinElement {}

define(compose({ name: 'acme-grid', element: AcmeGrid }));
define(compose({ name: 'acme-stack', element: AcmeStack }));
