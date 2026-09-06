import { describe, it, expect } from "vitest";
import { SARVAM_STT_LANG, SARVAM_TTS_LANG } from "@/lib/voice/types";
import { parseVoiceCommand } from "@/lib/voice/commands";
import {
  VOICE_LANGS,
  bcp47For,
  fromBcp47,
  isVoiceLang,
  type VoiceLang,
} from "@/lib/voice/languages";

describe("Voice Language Parameter Mapping & 10-Language Support (Item 1)", () => {
  const expectedLanguages: { code: VoiceLang; bcp47: string }[] = [
    { code: "en", bcp47: "en-IN" },
    { code: "hi", bcp47: "hi-IN" },
    { code: "mr", bcp47: "mr-IN" },
    { code: "kn", bcp47: "kn-IN" },
    { code: "ta", bcp47: "ta-IN" },
    { code: "te", bcp47: "te-IN" },
    { code: "gu", bcp47: "gu-IN" },
    { code: "pa", bcp47: "pa-IN" },
    { code: "ur", bcp47: "ur-IN" },
    { code: "ml", bcp47: "ml-IN" },
  ];

  it("contains all 10 required Indian languages in VOICE_LANGS", () => {
    expect(VOICE_LANGS).toHaveLength(10);
    const codes = VOICE_LANGS.map((l) => l.code);
    for (const expected of expectedLanguages) {
      expect(codes).toContain(expected.code);
    }
  });

  it("maps all 10 languages correctly in SARVAM_STT_LANG and SARVAM_TTS_LANG", () => {
    for (const { code, bcp47 } of expectedLanguages) {
      expect(SARVAM_STT_LANG[code]).toBe(bcp47);
      expect(SARVAM_TTS_LANG[code]).toBe(bcp47);
      expect(bcp47For(code)).toBe(bcp47);
    }
  });

  it("correctly resolves voiceLang from FormData-like parameters", () => {
    function resolveVoiceLangFromForm(fields: Record<string, string>): string | undefined {
      const rawLang = fields.voiceLang || fields.lang;
      const normalized = rawLang?.trim();
      const resolvedLang: VoiceLang | null =
        normalized && isVoiceLang(normalized)
          ? normalized
          : normalized
            ? fromBcp47(normalized)
            : null;
      return resolvedLang ? bcp47For(resolvedLang) : undefined;
    }

    // Canonical voiceLang supplied
    expect(resolveVoiceLangFromForm({ voiceLang: "ta" })).toBe("ta-IN");
    expect(resolveVoiceLangFromForm({ voiceLang: "kn" })).toBe("kn-IN");
    expect(resolveVoiceLangFromForm({ voiceLang: "mr" })).toBe("mr-IN");

    // Legacy fallback lang supplied
    expect(resolveVoiceLangFromForm({ lang: "hi" })).toBe("hi-IN");
    expect(resolveVoiceLangFromForm({ lang: "en" })).toBe("en-IN");

    // Both supplied: canonical voiceLang takes precedence
    expect(resolveVoiceLangFromForm({ voiceLang: "te", lang: "hi" })).toBe("te-IN");

    // BCP-47 directly supplied
    expect(resolveVoiceLangFromForm({ voiceLang: "ml-IN" })).toBe("ml-IN");

    // Omitted / auto
    expect(resolveVoiceLangFromForm({})).toBeUndefined();
    expect(resolveVoiceLangFromForm({ voiceLang: "auto" })).toBeUndefined();
  });
});
