import type { VoiceCommand, VoiceCommandKind } from "./types";

/**
 * Deterministic keyword matching for the small, closed set of things a
 * passenger says once we're past the initial goal capture (confirm / reject
 * / repeat / cancel). English + Hindi (Latin + Devanagari), kept intentionally
 * simple — this is never asked to interpret the travel goal itself, only the
 * yes/no moment. That keeps the demo reliable without an extra AI round trip.
 *
 * Matching is whole-word/whole-phrase, never a raw substring check — a naive
 * `.includes("no")` would wrongly fire on "I know" or "not now". Phrases with
 * spaces are matched as substrings (they're specific enough to be safe);
 * single words are matched on word boundaries.
 */
const PATTERNS: { kind: VoiceCommandKind; words: string[] }[] = [
  {
    kind: "confirm",
    words: [
      "yes",
      "yeah",
      "yep",
      "yup",
      "sure",
      "correct",
      "ok",
      "okay",
      "confirm",
      "choose it",
      "select it",
      "book it",
      "do it",
      "go ahead",
      "sounds good",
      "that works",
      "haan",
      "haanji",
      "theek hai",
      "kar do",
      "ठीक है",
      "हाँ",
      "हां",
      "कर दो",
      "इसे चुनो",
      "इसे चुन लो",
    ],
  },
  {
    kind: "reject",
    words: [
      "no",
      "nope",
      "nah",
      "not this",
      "not that one",
      "don't choose",
      "don't book",
      "don't want that",
      "wrong one",
      "nahi",
      "nahin",
      "nahi chahiye",
      "नहीं",
      "नही",
      "नहीं चाहिए",
    ],
  },
  {
    kind: "repeat",
    words: [
      "repeat",
      "repeat that",
      "say that again",
      "say again",
      "come again",
      "what was that",
      "pardon",
      "again",
      "dobara",
      "dubara",
      "dobara bolo",
      "फिर से",
      "दोबारा",
      "दोबारा बताओ",
    ],
  },
  {
    kind: "cancel",
    words: [
      "stop",
      "cancel",
      "close",
      "never mind",
      "nevermind",
      "band karo",
      "chhodo",
      "छोड़ो",
      "बंद करो",
    ],
  },
];

// Single words (no internal space) are matched on a word boundary so they
// can't fire inside an unrelated word ("no" inside "know"/"not now" spoken
// together, "ok" inside "broke", etc.). Multi-word phrases are specific
// enough to match as plain substrings.
function phraseMatches(norm: string, phrase: string): boolean {
  if (phrase.includes(" ")) return norm.includes(phrase);
  // \b doesn't understand Devanagari as a "word" boundary the same way it
  // does Latin script, so fall back to substring matching for non-Latin
  // single tokens (they're distinctive enough — e.g. "हाँ", "नहीं").
  if (!/^[a-z]+$/.test(phrase)) return norm.includes(phrase);
  return new RegExp(`\\b${phrase}\\b`).test(norm);
}

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"“”’]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Classify a short spoken utterance into one of the known voice commands.
 * If the utterance matches more than one *different* kind (a genuinely
 * ambiguous sentence), we deliberately return "unknown" rather than guess —
 * an accidental confirmation is far worse than asking the user to repeat
 * themselves.
 */
export function parseVoiceCommand(text: string): VoiceCommand {
  const norm = normalize(text);
  if (!norm) return { kind: "unknown", raw: text };

  const matchedKinds = new Set<VoiceCommandKind>();
  for (const { kind, words } of PATTERNS) {
    if (words.some((w) => phraseMatches(norm, w))) matchedKinds.add(kind);
  }

  if (matchedKinds.size === 1) {
    return { kind: [...matchedKinds][0], raw: text };
  }
  return { kind: "unknown", raw: text };
}
