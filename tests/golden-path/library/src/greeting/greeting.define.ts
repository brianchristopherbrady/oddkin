// Keeps greeting.ts's tag-name typing in this entry's declarations (see tally.define.ts).
/// <reference path="./greeting.ts" preserve="true" />
import { define } from '@oddkin/core';
import { greetingDefinition } from './greeting.definition.js';

define(greetingDefinition);
