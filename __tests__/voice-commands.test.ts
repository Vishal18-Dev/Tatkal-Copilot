import { describe, it, expect } from "vitest";
import { parseVoiceCommand } from "@/lib/voice/commands";

describe("Voice command parsing", () => {
  it("recognizes English confirmations", () => {
    for (const phrase of ["yes", "Yes!", "yeah", "okay", "choose it", "book it", "go ahead."]) {
      expect(parseVoiceCommand(phrase).kind).toBe("confirm");
    }
  });

  it("recognizes Hindi confirmations (Devanagari and Latin)", () => {
    for (const phrase of ["हाँ", "हां", "ठीक है", "कर दो", "haan", "theek hai"]) {
      expect(parseVoiceCommand(phrase).kind).toBe("confirm");
    }
  });

  it("recognizes English rejections", () => {
    for (const phrase of ["no", "nope", "not that one", "wrong one"]) {
      expect(parseVoiceCommand(phrase).kind).toBe("reject");
    }
  });

  it("recognizes Hindi rejections", () => {
    for (const phrase of ["नहीं", "nahi", "नहीं चाहिए"]) {
      expect(parseVoiceCommand(phrase).kind).toBe("reject");
    }
  });

  it("recognizes repeat requests in both languages", () => {
    for (const phrase of ["repeat that", "say that again", "फिर से", "दोबारा बताओ", "dobara bolo"]) {
      expect(parseVoiceCommand(phrase).kind).toBe("repeat");
    }
  });

  it("recognizes cancel requests in both languages", () => {
    for (const phrase of ["cancel", "never mind", "बंद करो", "chhodo"]) {
      expect(parseVoiceCommand(phrase).kind).toBe("cancel");
    }
  });

  it("recognizes mixed-language (Hinglish) confirmation", () => {
    expect(parseVoiceCommand("haan bhai, choose it").kind).toBe("confirm");
    expect(parseVoiceCommand("ठीक है, book it कर दो").kind).toBe("confirm");
  });

  it("is case- and punctuation-insensitive", () => {
    expect(parseVoiceCommand("YES!!").kind).toBe("confirm");
    expect(parseVoiceCommand("  No.  ").kind).toBe("reject");
  });

  it("does not false-positive on words that merely contain a keyword", () => {
    // "no" must not fire inside "know" — word-boundary matching, not substring.
    expect(parseVoiceCommand("I know that train well").kind).toBe("unknown");
    expect(parseVoiceCommand("okay, I know that one").kind).toBe("confirm"); // "okay" still wins on its own token
  });

  it("returns unknown for unrelated speech instead of guessing", () => {
    expect(parseVoiceCommand("Mumbai to Delhi tomorrow").kind).toBe("unknown");
    expect(parseVoiceCommand("").kind).toBe("unknown");
    expect(parseVoiceCommand("   ").kind).toBe("unknown");
  });

  it("refuses to guess on a genuinely ambiguous utterance (multiple command kinds match)", () => {
    // Contains both a confirm and a reject keyword — must not silently pick one.
    const result = parseVoiceCommand("no wait, yes, go ahead");
    expect(result.kind).toBe("unknown");
  });

  it("never returns confirm for a rejection, and vice versa", () => {
    expect(parseVoiceCommand("no").kind).not.toBe("confirm");
    expect(parseVoiceCommand("yes").kind).not.toBe("reject");
  });
});
