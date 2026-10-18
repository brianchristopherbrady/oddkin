import { compose } from '@oddkin/core/element';
import { actionApprovalDefinition } from '../action-approval/action-approval.definition.js';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinToolCall } from './tool-call.js';
import { toolCallStyles } from './tool-call.styles.js';
import { toolCallTemplate } from './tool-call.template.js';

export const toolCallDefinition = compose({
  name: 'odd-tool-call',
  element: OddkinToolCall,
  template: toolCallTemplate,
  styles: [aiBaseStyles, toolCallStyles],
  dependencies: { approval: actionApprovalDefinition },
});
