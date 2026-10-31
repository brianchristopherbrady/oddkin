import type { Server } from 'node:http';

/** The example's HTTP server, not yet listening: `root` is served, `pace` is ms per chunk. */
export function createChatServer(options?: { root?: string; pace?: number }): Server;
