// The reference keeps tally.ts's tag-name typing in this entry's declarations, so importing
// `@acme/widgets/define/tally` also types `document.createElement('acme-tally')`.
/// <reference path="./tally.ts" preserve="true" />
import { define } from '@oddkin/core';
import { tallyDefinition } from './tally.definition.js';

define(tallyDefinition);
