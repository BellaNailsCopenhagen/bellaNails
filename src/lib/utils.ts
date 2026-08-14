import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * PostgREST types a foreign-key embed as the related row OR an array of them,
 * depending on the relationship shape. Normalize to the single row (or null).
 */
export function firstOf<T>(value: T | T[] | null | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null
}
