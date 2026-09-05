import { describe, it, expect } from "vitest";
import {
  VOICE_LANGS,
  bcp47For,
  fromBcp47,
  isVoiceLang,
  voiceLangDef,
  type VoiceLang,
} from "@/lib/voice/languages";
import { MockVoiceProvider } from "@/lib/voice/provider";

const REQUIRED: VoiceLang[] = ["en", "hi", "mr", "kn", "ta", "te", "gu", "pa", "ur", "ml"];

describe("Voice languages — the 10 required, one internal representation", () => {
  it("defines exactly the 10 required languages", () => {
    const codes = VOICE_LANGS.map((l) => l.code);
    expect(codes.sort()).toEqual([...REQUIRED].sort());
  });

  it("each has a BCP-47 code, a native endonym and an English name", () => {
    for (const l of VOICE_LANGS) {
      expect(l.bcp47).toMatch(/^[a-z]{2}-IN$/);
      expect(l.nativeName.length).toBeGreaterThan(0);
      expect(l.englishName.length).toBeGreaterThan(0);
    }
  });

  it("native names are genuinely native (not just the English name) for non-English langs", () => {
    for (const l of VOICE_LANGS) {
      if (l.code === "en") continue;
      expect(l.nativeName).not.toBe(l.englishName);
    }
  });

  it("resolves BCP-47 ↔ VoiceLang both ways", () => {
    expect(bcp47For("ta")).toBe("ta-IN");
    expect(fromBcp47("ta-IN")).toBe("ta");
    expect(fromBcp47("hi-IN")).toBe("hi");
    // tolerant of a bare primary subtag from detection
    expect(fromBcp47("ml")).toBe("ml");
    expect(fromBcp47(null)).toBeNull();
    expect(fromBcp47("fr-FR")).toBeNull();
  });

  it("isVoiceLang guards unknown codes", () => {
    expect(isVoiceLang("hi")).toBe(true);
    expect(isVoiceLang("xx")).toBe(false);
  });

  it("voiceLangDef falls back to English for an unknown code", () => {
    expect(voiceLangDef("zz" as VoiceLang).code).toBe("en");
  });
});

describe("MockVoiceProvider — deterministic offline fallback", () => {
  it("transcribes to a deterministic English goal (feeds the frozen planner)", async () => {
    const p = new MockVoiceProvider();
    const r = await p.transcribe(new Blob(["x"]), "clip.webm");
    expect(r.transcript).toMatch(/mumbai/i);
    expect(r.languageCode).toBe("en-IN");
  });

  it("translate echoes text (mock can't translate) and synth returns no audio", async () => {
    const p = new MockVoiceProvider();
    expect(await p.translate("hello")).toBe("hello");
    const s = await p.synthesize("hello", "ta-IN");
    expect(s.audioBase64).toBeUndefined(); // callers show caption, skip playback
    expect(s.audioCodec).toBe("mp3");
  });
});
