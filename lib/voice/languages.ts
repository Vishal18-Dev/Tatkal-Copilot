/* ============================================================
   Voice languages — the 10 spoken languages the Copilot supports.

   This is a SEPARATE, wider concept from the app UI `Lang` (which
   is en/hi only, for on-screen chrome). VoiceLang is *conversation
   context*: which language the user is speaking and hearing right
   now. Input is language-independent (Sarvam STT translate mode →
   English → the frozen planner); output is rendered back into the
   active VoiceLang via Sarvam text-translate + TTS.

   Client-safe: no API key, no server imports. The UI language
   selector and the transcript language chips read from here.
   ============================================================ */

export type VoiceLang =
  | "en"
  | "hi"
  | "mr"
  | "kn"
  | "ta"
  | "te"
  | "gu"
  | "pa"
  | "ur"
  | "ml";

export interface VoiceLangDef {
  code: VoiceLang;
  /** BCP-47 code Sarvam expects (STT/TTS/translate). */
  bcp47: string;
  /** Endonym — shown in the selector exactly as a speaker would recognise it. */
  nativeName: string;
  /** English name, for accessible labels and secondary text. */
  englishName: string;
}

export const VOICE_LANGS: VoiceLangDef[] = [
  { code: "en", bcp47: "en-IN", nativeName: "English", englishName: "English" },
  { code: "hi", bcp47: "hi-IN", nativeName: "हिन्दी", englishName: "Hindi" },
  { code: "mr", bcp47: "mr-IN", nativeName: "मराठी", englishName: "Marathi" },
  { code: "kn", bcp47: "kn-IN", nativeName: "ಕನ್ನಡ", englishName: "Kannada" },
  { code: "ta", bcp47: "ta-IN", nativeName: "தமிழ்", englishName: "Tamil" },
  { code: "te", bcp47: "te-IN", nativeName: "తెలుగు", englishName: "Telugu" },
  { code: "gu", bcp47: "gu-IN", nativeName: "ગુજરાતી", englishName: "Gujarati" },
  { code: "pa", bcp47: "pa-IN", nativeName: "ਪੰਜਾਬੀ", englishName: "Punjabi" },
  { code: "ur", bcp47: "ur-IN", nativeName: "اردو", englishName: "Urdu" },
  { code: "ml", bcp47: "ml-IN", nativeName: "മലയാളം", englishName: "Malayalam" },
];

const BY_CODE = new Map(VOICE_LANGS.map((l) => [l.code, l]));

export function voiceLangDef(code: VoiceLang): VoiceLangDef {
  return BY_CODE.get(code) ?? VOICE_LANGS[0];
}

export function bcp47For(code: VoiceLang): string {
  return voiceLangDef(code).bcp47;
}

export function isVoiceLang(v: string): v is VoiceLang {
  return BY_CODE.has(v as VoiceLang);
}

/** Map a Sarvam-returned language code (e.g. "ta-IN") back to a VoiceLang. */
export function fromBcp47(bcp47: string | null | undefined): VoiceLang | null {
  if (!bcp47) return null;
  const found = VOICE_LANGS.find((l) => l.bcp47 === bcp47 || l.bcp47.split("-")[0] === bcp47.split("-")[0]);
  return found?.code ?? null;
}
