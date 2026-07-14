/**
 * Collapse a Next.js searchParams value to a single string: repeated params
 * (`?service=a&service=b`) resolve to the first occurrence. One shared
 * helper so every page parses query params with the same semantics.
 */
export function singleParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
