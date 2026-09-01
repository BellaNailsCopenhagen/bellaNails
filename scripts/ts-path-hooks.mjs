/**
 * Module-resolution hooks so `node --test` can run the TypeScript sources
 * directly (Node ≥ 22 strips types itself). Two things Node can't do alone:
 * resolve the `@/*` path alias, and add the `.ts` extension the source omits.
 *
 * Deliberately dependency-free — the project has no test framework, and adding
 * one is a bigger decision than a test helper.
 */
const SRC = new URL("../src/", import.meta.url)

const CANDIDATES = (base) => [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]

export async function resolve(specifier, context, next) {
  const target = specifier.startsWith("@/")
    ? new URL(specifier.slice(2), SRC).href
    : specifier

  const relative = target.startsWith(".") || target.startsWith("file:")
  if (relative && !/\.[cm]?[jt]sx?$/.test(target)) {
    for (const candidate of CANDIDATES(target)) {
      try {
        return await next(candidate, context)
      } catch {
        /* try the next shape */
      }
    }
  }
  return next(target, context)
}
