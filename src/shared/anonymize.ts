/**
 * The placeholder every email field of an anonymized client becomes on GDPR
 * erasure — unique per client (so `clients.email`'s unique constraint holds) and
 * on a reserved non-deliverable domain. One definition so the clients row and its
 * communications log scramble identically.
 */
export const redactedEmail = (clientId: string) =>
  `redacted-${clientId}@anonymized.invalid`
