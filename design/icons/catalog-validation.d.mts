import type { ValidateFunction } from 'ajv';

export function catalogValidator(schema: object): ValidateFunction;
export function validateCatalog(data: unknown, validate: ValidateFunction): void;
