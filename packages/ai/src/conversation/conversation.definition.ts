import { compose } from '@oddkin/core/element';
import { activityDefinition } from '../activity/activity.definition.js';
import { aiBaseStyles } from '../internal/base.styles.js';
import { messageDefinition } from '../message/message.definition.js';
import { OddkinConversation } from './conversation.js';
import { conversationStyles } from './conversation.styles.js';
import { conversationTemplate } from './conversation.template.js';

export const conversationDefinition = compose({
  name: 'odd-conversation',
  element: OddkinConversation,
  template: conversationTemplate,
  styles: [aiBaseStyles, conversationStyles],
  dependencies: { message: messageDefinition, activity: activityDefinition },
});
