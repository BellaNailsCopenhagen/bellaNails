/**
 * Versioned legal documents and the record of who accepted which version.
 * Documents are never edited in place — publishing mints a new version and
 * moves the `is_current` flag, so an acceptance always points at exact text.
 */
export {
  getCurrentTerms,
  getTermsVersions,
  isTermsKind,
  localizeTerms,
  TERMS_KINDS,
  type LocalizedTerms,
  type TermsKind,
  type TermsRecord,
} from "./terms"
export {
  getTermsAcceptances,
  recordTermsAcceptance,
  type TermsAcceptance,
} from "./acceptance"
export { saveTermsVersion } from "./actions"
