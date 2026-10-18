import { buttonDefinition } from '@oddkin/components/button';
import { compose } from '@oddkin/core/element';
import { actionApprovalDefinition } from '../action-approval/action-approval.definition.js';
import { aiLabelDefinition } from '../ai-label/ai-label.definition.js';
import { artifactDefinition } from '../artifact/artifact.definition.js';
import { aiBaseStyles } from '../internal/base.styles.js';
import { messageBranchDefinition } from '../message-branch/message-branch.definition.js';
import { responseFeedbackDefinition } from '../response-feedback/response-feedback.definition.js';
import { responseDefinition } from '../response/response.definition.js';
import { sourcesDefinition } from '../sources/sources.definition.js';
import { toolCallDefinition } from '../tool-call/tool-call.definition.js';
import { OddkinMessage } from './message.js';
import { messageStyles } from './message.styles.js';
import { messageTemplate } from './message.template.js';

export const messageDefinition = compose({
  name: 'odd-message',
  element: OddkinMessage,
  template: messageTemplate,
  styles: [aiBaseStyles, messageStyles],
  dependencies: {
    button: buttonDefinition,
    response: responseDefinition,
    sources: sourcesDefinition,
    toolCall: toolCallDefinition,
    approval: actionApprovalDefinition,
    artifact: artifactDefinition,
    branch: messageBranchDefinition,
    feedback: responseFeedbackDefinition,
    label: aiLabelDefinition,
  },
});
