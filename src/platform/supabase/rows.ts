/**
 * PostgREST types a foreign-key embed as the related row OR an array of them,
 * depending on the relationship shape. Normalize to the single row (or null).
 */
export function firstOf<T>(value: T | T[] | null | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null
}
