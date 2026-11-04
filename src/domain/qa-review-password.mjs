/**
 * Validate a shared temporary password ONLY for pre-existing QA review
 * identities. Does not change requirements for new or real users.
 * The value is never logged, serialized into Git, or exposed in responses.
 */
export function normalizeQaReviewPassword(value){
  if(typeof value!=='string')return null;
  const normalized=value.trim();
  return /^[A-Za-z0-9]{8}$/.test(normalized)?normalized:null;
}
