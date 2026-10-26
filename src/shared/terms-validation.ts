/**
 * What a terms document must contain before it can go live.
 *
 * Publishing makes the new version CURRENT the moment it lands, and that is
 * what `/terms` and `/privacy` serve — in both languages — to clients who then
 * accept it by name at step 03. So a blank field here is not an unfinished
 * draft: it is a live legal page with nothing on it that people are on record
 * as having agreed to. History is immutable and there is no rollback, so the
 * refusal has to happen before the insert.
 *
 * Both titles and both bodies are required for the same reason: there is no
 * locale a client can be sent to that is allowed to be empty.
 *
 * Isomorphic on purpose — the editor disables Publish with this and the action
 * refuses with it, so the button and the server can never disagree.
 */

export type TermsFields = {
  titleEn: string
  titleDk: string
  bodyEn: string
  bodyDk: string
}

export type TermsField = keyof TermsFields

/**
 * A real document is longer than this. The number is not the point — catching
 * a stray keystroke published as terms is, and no genuine notice is six words.
 */
export const TERMS_MIN_BODY = 40

const LABEL: Record<TermsField, string> = {
  titleEn: "English title",
  titleDk: "Danish title",
  bodyEn: "English body",
  bodyDk: "Danish body",
}

export type TermsProblem = { field: TermsField; message: string }

/** The first thing wrong, or null when it can be published. */
export function termsProblem(input: TermsFields): TermsProblem | null {
  for (const field of ["titleEn", "titleDk"] as const) {
    if (!input[field].trim()) {
      return { field, message: `The ${LABEL[field]} is empty.` }
    }
  }
  for (const field of ["bodyEn", "bodyDk"] as const) {
    const body = input[field].trim()
    if (!body) {
      return { field, message: `The ${LABEL[field]} is empty.` }
    }
    if (body.length < TERMS_MIN_BODY) {
      return {
        field,
        message: `The ${LABEL[field]} is too short to be a real document.`,
      }
    }
  }

  return null
}

/** Both languages of one document are publishable. */
export const canPublishTerms = (input: TermsFields): boolean =>
  termsProblem(input) === null
