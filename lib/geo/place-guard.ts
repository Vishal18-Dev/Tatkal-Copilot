/**
 * Guards against non-geographic terms, conversational action verbs,
 * and commercial tour agencies being parsed or resolved as railway stations/cities.
 */

export const INVALID_EXACT = new Set([
  "the", "a", "an", "trip", "the trip", "this trip", "book", "booking", "book it", "book this",
  "book the trip", "book this trip", "to book", "to book the trip", "start", "start my journey",
  "start journey", "my journey", "a journey", "the journey", "journey", "our journey",
  "travel", "travelling", "train", "the train", "this train", "ticket", "tickets", "the ticket",
  "tatkal", "reservation", "it", "here", "there", "window", "site", "portal", "agent", "call",
  "questions", "question", "status", "somewhere", "anywhere", "nowhere", "stop", "cancel",
  // Conversational acknowledgements and fillers
  "ok", "okay", "okie", "k", "sure", "yes", "yeah", "yep", "yup", "hmm", "hm", "right",
  "got it", "fine", "alright", "all right", "haan", "theek hai", "theek", "ha", "achha",
  "acha", "accha", "bilkul", "done", "cool", "understood", "perfect"
]);

/**
 * Returns true if a string represents an action verb, travel intent phrase,
 * or commercial business (e.g. tour operator) rather than a railway station or city.
 */
export function isInvalidPlaceCandidate(name: string | undefined | null): boolean {
  if (!name) return true;
  const clean = name.trim().toLowerCase();
  if (clean.length < 2 || clean.length > 60) return true;

  if (INVALID_EXACT.has(clean)) return true;

  // Prefix check: verbal / prepositional phrases
  if (/^(?:to\s+|from\s+|start(?:ing)?\s+|begin(?:ning)?\s+|book(?:ing)?\s+|my\s+|the\s+|a\s+|an\s+|want\s+)/i.test(clean)) {
    return true;
  }

  // Word boundary check: domain action nouns that never represent cities or railway stations
  if (/\b(?:journey|trip|travel|travelling|train|ticket|tickets|tatkal|booking|tour|tours|holiday|holidays)\b/i.test(clean)) {
    return true;
  }

  return false;
}
