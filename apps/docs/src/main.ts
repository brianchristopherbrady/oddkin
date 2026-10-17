import { packageName as app } from '@mote/app';
import { packageName as components } from '@mote/components';
import { packageName as core } from '@mote/core';
import { packageName as state } from '@mote/state';
import { packageName as tokens } from '@mote/tokens';

/**
 * M1 skeleton: proves the docs app resolves every package through its public
 * `exports`. The documentation shell is built in M5.
 */
export const consumedPackages = [core, tokens, state, app, components] as const;
