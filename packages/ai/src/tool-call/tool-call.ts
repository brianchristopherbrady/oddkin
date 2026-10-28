import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import type { ApprovalRecord, Capabilities, ToolCallRecord } from '../contracts/types.js';
import { toolRetryEvent } from '../events.js';
import { strings } from '../internal/strings.js';

export const TOOL_CALL_STRINGS = {
  'input-streaming': 'Preparing arguments…',
  'input-available': 'Arguments ready; not run yet',
  'awaiting-approval': 'Waiting for approval',
  executing: 'Running…',
  'output-available': 'Finished',
  'output-error': 'Failed',
  denied: 'Not run: denied',
  cancelled: 'Cancelled',
  arguments: 'Arguments',
  result: 'Result',
  error: 'Error',
  retry: 'Retry',
  details: 'Details',
};

/** Render a tool result; return undefined to fall back to the JSON view. Output is untrusted. */
export type ToolOutputRenderer = (tool: ToolCallRecord) => Node | undefined;

/**
 * One tool call: identity, purpose, streamed arguments, execution state, result or failure, and
 * the recovery actions the host supports. Argument generation, approval, and execution are
 * shown as distinct states; complete arguments never read as success.
 *
 * @csspart base - The tool call surface.
 * @csspart summary - Name, purpose, and status (a native disclosure summary).
 * @csspart arguments - Streamed or complete arguments.
 * @csspart result - Result or error.
 * @a11y Status is text, not colour alone. Details use a native disclosure; its open state is local presentation state the element never overrides.
 * @keyboard Enter or Space toggles the details.
 * @useFor Showing what an agent or model asked a tool to do, and what happened.
 * @notFor Arbitrary log output.
 * @limitation Results render as formatted JSON text unless a host `renderOutput` returns a node.
 * @customization 1 2
 * @category AI
 */
export class OddkinToolCall extends OddkinElement.with({
  tool: prop.object<ToolCallRecord>({ description: 'The tool call record.' }),
  approval: prop.object<ApprovalRecord>({
    description: 'Approval bound to this call, when one was requested.',
  }),
  capabilities: prop.object<Capabilities>({ description: 'Passed to the nested approval.' }),
  renderOutput: prop.object<{ render: ToolOutputRenderer }>({
    description: 'Host renderer for results (`{ render(tool) }`).',
  }),
  strings: prop.object<Partial<typeof TOOL_CALL_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = { 'odd-tool-retry': toolRetryEvent };
  declare readonly _events?: ElementEvents<typeof OddkinToolCall>;

  /** @internal */
  get _strings(): typeof TOOL_CALL_STRINGS {
    return strings(TOOL_CALL_STRINGS, this.strings);
  }

  /** @internal */
  readonly _retry = (): void => {
    const tool = this.tool;
    if (tool?.status === 'output-error' && tool.retryable)
      this.emit(toolRetryEvent, { toolCallId: tool.toolCallId });
  };

  /** @internal Formatted arguments: streamed text while generating, then the parsed input. */
  _arguments(): string {
    const tool = this.tool;
    if (!tool) return '';
    if (tool.input !== undefined) return JSON.stringify(tool.input, null, 2);
    return tool.inputText ?? '';
  }

  /** @internal */
  _output(): Node | string | undefined {
    const tool = this.tool;
    if (!tool || tool.output === undefined) return undefined;
    return this.renderOutput?.render(tool) ?? JSON.stringify(tool.output, null, 2);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-tool-call': OddkinToolCall;
  }
}
