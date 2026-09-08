import { describe, it, expect } from "vitest";
import {
  VOICE_LANGS,
  bcp47For,
  fromBcp47,
  isVoiceLang,
  voiceLangDef,
  detectVoiceLanguage,
  isLanguageSwitchRequest,
  getLanguageDialogue,
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

describe("Multilingual Spoken Auto-Detection & 10 Indian Languages Dialogue Packs", () => {
  it("detects Hindi from user phrase: 'Hindi mein bol sakte hain Kya'", () => {
    expect(detectVoiceLanguage("Hindi mein bol sakte hain Kya")).toBe("hi");
    expect(isLanguageSwitchRequest("Hindi mein bol sakte hain Kya")).toBe(true);
  });

  it("detects all 10 Indian languages from explicit and phonetic queries", () => {
    expect(detectVoiceLanguage("Can you speak in Tamil")).toBe("ta");
    expect(detectVoiceLanguage("Telugu lo matladandi")).toBe("te");
    expect(detectVoiceLanguage("Kannada dalli mathadi")).toBe("kn");
    expect(detectVoiceLanguage("Marathit bola")).toBe("mr");
    expect(detectVoiceLanguage("Gujarati ma bolo")).toBe("gu");
    expect(detectVoiceLanguage("Malayalam samsarikkoo")).toBe("ml");
    expect(detectVoiceLanguage("Punjabi vich gal karo")).toBe("pa");
    expect(detectVoiceLanguage("Urdu me boliye")).toBe("ur");
    expect(detectVoiceLanguage("Please speak in English")).toBe("en");
  });

  it("detects all 10 Indian languages from native Unicode script text", () => {
    expect(detectVoiceLanguage("வணக்கம்")).toBe("ta");
    expect(detectVoiceLanguage("నమస్కారం")).toBe("te");
    expect(detectVoiceLanguage("ನಮಸ್ಕಾರ")).toBe("kn");
    expect(detectVoiceLanguage("നമസ്കാരം")).toBe("ml");
    expect(detectVoiceLanguage("નમસ્તે")).toBe("gu");
    expect(detectVoiceLanguage("ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ")).toBe("pa");
    expect(detectVoiceLanguage("آداب")).toBe("ur");
    expect(detectVoiceLanguage("नमस्ते")).toBe("hi");
    expect(detectVoiceLanguage("आहे नमस्कार")).toBe("mr");
  });

  it("contains complete dialogue packs for all 10 languages", () => {
    const langs: VoiceLang[] = ["en", "hi", "ta", "mr", "kn", "te", "gu", "ml", "pa", "ur"];
    for (const lang of langs) {
      const pack = getLanguageDialogue(lang);
      expect(pack.switchAck.length).toBeGreaterThan(0);
      expect(pack.briefingMessage.length).toBeGreaterThan(0);
      expect(pack.yesAvailableLabel.length).toBeGreaterThan(0);
      expect(pack.yesAvailableResponse.length).toBeGreaterThan(0);
      expect(pack.allGoodLabel.length).toBeGreaterThan(0);
      expect(pack.farewellResponse.length).toBeGreaterThan(0);
      expect(pack.outsideLabel.length).toBeGreaterThan(0);
      expect(pack.outsideResponse.length).toBeGreaterThan(0);
      expect(pack.authorizeLabel.length).toBeGreaterThan(0);
    }
  });

  it("isScriptForLanguage detects native scripts and guards against reverse-translation corruption", async () => {
    const { isScriptForLanguage } = await import("@/lib/voice/languages");

    // Hindi & Marathi
    expect(isScriptForLanguage("नमस्ते! मैं तत्काल कोपायलट से बोल रहा हूँ।", "hi")).toBe(true);
    expect(isScriptForLanguage("नमस्कार! मी तत्काळ कोपायलटवरून बोलतोय.", "mr")).toBe(true);
    expect(isScriptForLanguage("Hello world", "hi")).toBe(false);

    // Tamil
    expect(isScriptForLanguage("வணக்கம்! நான் தட்கல் கோபைலட்டிலிருந்து பேசுகிறேன்.", "ta")).toBe(true);
    expect(isScriptForLanguage("Hello world", "ta")).toBe(false);

    // Telugu
    expect(isScriptForLanguage("నమస్కారం! నేను తత్కాల్ కోపైలట్ నుండి మాట్లాడుతున్నాను.", "te")).toBe(true);
    expect(isScriptForLanguage("Hello world", "te")).toBe(false);

    // Kannada
    expect(isScriptForLanguage("ನಮಸ್ಕಾರ! ನಾನು ತತ್ಕಾಲ್ ಕೋಪೈಲಟ್‌ನಿಂದ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ.", "kn")).toBe(true);
    expect(isScriptForLanguage("Hello world", "kn")).toBe(false);

    // Gujarati
    expect(isScriptForLanguage("નમસ્તે! હું તત્કાલ કોપાયલોટમાંથી વાત કરું છું.", "gu")).toBe(true);
    expect(isScriptForLanguage("Hello world", "gu")).toBe(false);

    // Malayalam
    expect(isScriptForLanguage("നമസ്കാരം! ഞാൻ തത്കാൽ കോപൈലറ്റിൽ നിന്നാണ് സംസാരിക്കുന്നത്.", "ml")).toBe(true);
    expect(isScriptForLanguage("Hello world", "ml")).toBe(false);

    // Punjabi
    expect(isScriptForLanguage("ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤਤਕਾਲ ਕੋਪਾਇਲਟ ਤੋਂ ਗੱਲ ਕਰ ਰਿਹਾ ਹਾਂ।", "pa")).toBe(true);
    expect(isScriptForLanguage("Hello world", "pa")).toBe(false);

    // Urdu
    expect(isScriptForLanguage("آداب! میں تتکال کوپائلٹ سے بات کر رہا ہوں۔", "ur")).toBe(true);
    expect(isScriptForLanguage("Hello world", "ur")).toBe(false);

    // English
    expect(isScriptForLanguage("Hello! This is Aarav from Tatkal Copilot.", "en")).toBe(true);
    expect(isScriptForLanguage("नमस्ते", "en")).toBe(false);
  });
});

