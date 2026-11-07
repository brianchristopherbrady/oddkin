import type { ArtifactRenderer } from '../artifact/artifact.js';
import type { ToolCallRecord } from '../contracts/types.js';
import type { DataRenderer } from '../message/message.js';
import type { ToolOutputRenderer } from '../tool-call/tool-call.js';

/**
 * Host renderers for record-driven content, by extension point (ai-interaction.md §6.2). One
 * object serves every element: a conversation hands it to its messages, and a message to its tool
 * calls and artifacts, so each takes the point it renders.
 */
export interface Renderers {
  /** `data` parts by name; each validates the untrusted data before rendering it. */
  readonly data?: Readonly<Record<string, DataRenderer>>;
  /** Artifact previews by kind; each renders into a container and may return a cleanup. */
  readonly artifact?: Readonly<Record<string, ArtifactRenderer>>;
  /** Tool results: a node, or undefined for the formatted JSON. */
  readonly toolOutput?: ToolOutputRenderer;
}

let warned = false;

/**
 * `renderers` by extension point, also when given in its shape before the points (until the next
 * beta): a map of `data` renderers by part name (`odd-message`, `odd-conversation`) or of artifact
 * renderers by kind (`odd-artifact`).
 */
function read(value: unknown, legacy: 'data' | 'artifact'): Renderers {
  if (!value || typeof value !== 'object') return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const old =
    legacy === 'data'
      ? entries.some(
          ([, v]) => typeof (v as Partial<DataRenderer> | undefined)?.validate === 'function',
        )
      : entries.some(([key, v]) => key !== 'toolOutput' && typeof v === 'function');
  if (!old) return value as Renderers;
  if (!warned) {
    warned = true;
    console.warn(
      `[ai.renderers.legacy] Pass { ${legacy}: … } to renderers; the old map works until the next beta.`,
    );
  }
  return { [legacy]: value };
}

/**
 * The renderers an element uses: `renderers`, with the deprecated per-point properties filling
 * the points it leaves out. The same inputs give the same object, so handing it down to nested
 * elements changes nothing for them.
 */
export function rendererCache(
  legacy: 'data' | 'artifact',
): (
  value: unknown,
  artifact?: Renderers['artifact'],
  tool?: { readonly render: ToolOutputRenderer },
) => Renderers {
  let last: readonly unknown[] = [];
  let result: Renderers = {};
  return (value, artifact, tool) => {
    const inputs = [value, artifact, tool];
    if (inputs.every((input, i) => input === last[i])) return result;
    last = inputs;
    const given = read(value, legacy);
    const kinds = given.artifact ?? artifact;
    const toolOutput =
      given.toolOutput ?? (tool && ((record: ToolCallRecord) => tool.render(record)));
    result = { ...given, ...(kinds && { artifact: kinds }), ...(toolOutput && { toolOutput }) };
    return result;
  };
}
