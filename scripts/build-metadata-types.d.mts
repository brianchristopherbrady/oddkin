export const METADATA_SCHEMA_FILE: string;
export const METADATA_TYPES_FILE: string;
/** The types module generated from a JSON Schema (the canonical `oddkin-metadata.v1` subset). */
export function generateMetadataTypes(schema: object): Promise<string>;
