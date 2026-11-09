import type { ArtifactRenderer } from '../artifact/artifact.js';
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
  /**
   * Artifact previews by kind; each renders into a container and may return a cleanup, run once
   * when the preview is replaced or the element disconnects.
   */
  readonly artifact?: Readonly<Record<string, ArtifactRenderer>>;
  /** Tool results: a node, or undefined for the formatted JSON. */
  readonly toolOutput?: ToolOutputRenderer;
}
