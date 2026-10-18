import { buttonDefinition } from '@oddkin/components/button';
import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinActionApproval } from './action-approval.js';
import { actionApprovalStyles } from './action-approval.styles.js';
import { actionApprovalTemplate } from './action-approval.template.js';

export const actionApprovalDefinition = compose({
  name: 'odd-action-approval',
  element: OddkinActionApproval,
  template: actionApprovalTemplate,
  styles: [aiBaseStyles, actionApprovalStyles],
  dependencies: { button: buttonDefinition },
});
