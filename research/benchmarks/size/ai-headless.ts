// Headless use: the conversation controller and contracts, no elements or DOM rendering.
import { ConversationController } from '@oddkin/ai/controllers';
import { normalizeSnapshot } from '@oddkin/ai/contracts';

export const create = () =>
  new ConversationController({ transport: { capabilities: {}, send: async () => {} } });
export { normalizeSnapshot };
