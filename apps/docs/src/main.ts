import { packageName as app } from '@oddkin/app';
import { packageName as components } from '@oddkin/components';
import { packageName as core } from '@oddkin/core';
import { packageName as state } from '@oddkin/state';
import { packageName as tokens } from '@oddkin/tokens';

/**
 * M1 skeleton: proves the docs app resolves every package through its public
 * `exports`. The documentation shell is built in M5.
 */
export const consumedPackages = [core, tokens, state, app, components] as const;
