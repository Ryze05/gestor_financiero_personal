import type { TransformFnParams } from 'class-transformer';

export function normalizeName({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
}