/** Read-only Figma Plugin API export behind design/figma/components.json. */
export function exportComponents(
  figma: unknown,
  pageIds: readonly string[],
  exportedAt: string,
): Promise<{
  fileKey: string;
  fileName: string;
  exportedAt: string;
  pages: unknown[];
  families: { id: string; name: string; instances: unknown[]; layers: unknown[] }[];
}>;
