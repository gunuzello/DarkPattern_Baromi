/**
 * Evidence ids users can look up are short codes like `ev_0142`. Keys such as
 * `page:checkout`, `evidence:product` or `surface:catalog:landing` are internal and hidden.
 */
export function visibleEvidenceIds(ids: (string | undefined | null)[] | undefined): string[] {
  return [...new Set((ids ?? []).filter((id): id is string => Boolean(id) && !id!.includes(":")))];
}

/**
 * The AI model sees request-local references like `evidence-1-2`; they mean nothing to a
 * shop owner. Drop them from parentheses and call any left in a sentence "확인 화면".
 */
export function cleanAiText(text: string): string {
  return text
    .replace(/\s*\((?:\s*evidence-[\d-]+\s*(?:,|및|와|과)?\s*)+(?:등)?\s*\)/gi, "")
    .replace(/evidence-[\d-]+(?:\s*(?:,|및)\s*evidence-[\d-]+)*(?:\s*등)?/gi, "확인 화면")
    .replace(/\s{2,}/g, " ")
    .trim();
}
