export type SupportedLanguage =
  | "en-IN"
  | "hi-IN"
  | "mr-IN"
  | "kn-IN"
  | "ta-IN"
  | "te-IN"
  | "gu-IN"
  | "pa-IN"
  | "ur-IN"
  | "ml-IN";

export type ShortLang =
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

export type LanguageSource = "user_selected" | "auto_detected";

export interface LanguageState {
  uiLanguage: SupportedLanguage;
  conversationLanguage: SupportedLanguage;
  detectedLanguage?: SupportedLanguage;
  source: LanguageSource;
}

export type TranslationPolicy = "translate" | "preserve" | "contextual";

export interface TerminologyEntry {
  key: string;
  english: string;
  category: "product" | "journey" | "tatkal" | "readiness" | "agent" | "recovery";
  policy: TranslationPolicy;
  translations: Record<SupportedLanguage, string>;
  notes?: string;
}

export function toSupportedLanguage(input?: string | null): SupportedLanguage {
  if (!input) return "en-IN";
  const norm = input.trim();
  if (norm.includes("-")) {
    const valid: SupportedLanguage[] = [
      "en-IN",
      "hi-IN",
      "mr-IN",
      "kn-IN",
      "ta-IN",
      "te-IN",
      "gu-IN",
      "pa-IN",
      "ur-IN",
      "ml-IN",
    ];
    if (valid.includes(norm as SupportedLanguage)) return norm as SupportedLanguage;
  }
  const prefix = norm.split("-")[0].toLowerCase();
  switch (prefix) {
    case "hi":
      return "hi-IN";
    case "mr":
      return "mr-IN";
    case "kn":
      return "kn-IN";
    case "ta":
      return "ta-IN";
    case "te":
      return "te-IN";
    case "gu":
      return "gu-IN";
    case "pa":
      return "pa-IN";
    case "ur":
      return "ur-IN";
    case "ml":
      return "ml-IN";
    case "en":
    default:
      return "en-IN";
  }
}

export function toShortLang(lang: SupportedLanguage | string): ShortLang {
  const full = toSupportedLanguage(lang);
  return full.split("-")[0] as ShortLang;
}
