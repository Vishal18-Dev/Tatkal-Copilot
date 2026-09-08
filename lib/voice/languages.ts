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

/**
 * Detect the spoken Indian language from text across all 10 supported languages:
 * English, Hindi, Tamil, Marathi, Kannada, Telugu, Gujarati, Malayalam, Punjabi, Urdu.
 * Checks native Unicode scripts, explicit language requests, and Romanized vocabulary.
 */
export function detectVoiceLanguage(text: string): VoiceLang | null {
  if (!text || !text.trim()) return null;
  const raw = text.trim();
  const lower = raw.toLowerCase();

  // 1. Explicit Language Switch Requests (e.g. "hindi mein bol sakte hain kya", "speak in tamil", "kannada please")
  if (/\b(hindi|hindustani)\b/i.test(lower)) return "hi";
  if (/\b(tamil|tamizh)\b/i.test(lower)) return "ta";
  if (/\b(telugu)\b/i.test(lower)) return "te";
  if (/\b(kannada|kannadalli|kannadadalli)\b/i.test(lower)) return "kn";
  if (/\b(marathi|marathit)\b/i.test(lower)) return "mr";
  if (/\b(gujarati|gujarathi)\b/i.test(lower)) return "gu";
  if (/\b(malayalam|malayalathil)\b/i.test(lower)) return "ml";
  if (/\b(punjabi|panjabi)\b/i.test(lower)) return "pa";
  if (/\b(urdu)\b/i.test(lower)) return "ur";
  if (/\b(english|angrezi)\b/i.test(lower)) return "en";

  // 2. Native Scripts
  if (/[\u0B80-\u0BFF]/.test(raw)) return "ta"; // Tamil
  if (/[\u0C00-\u0C7F]/.test(raw)) return "te"; // Telugu
  if (/[\u0C80-\u0CFF]/.test(raw)) return "kn"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(raw)) return "ml"; // Malayalam
  if (/[\u0A80-\u0AFF]/.test(raw)) return "gu"; // Gujarati
  if (/[\u0A00-\u0A7F]/.test(raw)) return "pa"; // Punjabi (Gurmukhi)
  if (/[\u0600-\u06FF]/.test(raw)) return "ur"; // Urdu (Arabic script)

  // Devanagari script: check Marathi markers vs Hindi
  if (/[\u0900-\u097F]/.test(raw)) {
    if (/(?:^|\s)(आहे|नाही|करा|सांगा|मला|इत्यादी|होय|कसे|काय|आहोत|धन्यवाद|चालू|करावे)(?:$|\s)/.test(raw)) {
      return "mr";
    }
    return "hi";
  }

  // 3. Romanized / Phonetic Lexical Markers
  if (/\b(vanakkam|sollunga|nandri|theriyum|ungalukku|illai|aama|seri|eppadi|venum|poitu|vaanga)\b/i.test(lower)) {
    return "ta";
  }
  if (/\b(namaskaram|avunu|kaadu|cheppandi|dhanyavadamulu|dhanyavadalu|ela|enti|sare|kavali|undi|velli|randi)\b/i.test(lower)) {
    return "te";
  }
  if (/\b(namaskara|haudu|illa|heli|dhanyavadagalu|enide|yelli|beku|hege|sari|banni|mathadi|maathadi)\b/i.test(lower)) {
    return "kn";
  }
  if (/\b(namaskaram|athe|illa|parayoo|nanni|entha|engane|undu|shari|pokatte|samsarikkoo|samsarikka)\b/i.test(lower)) {
    return "ml";
  }
  if (/\b(namaste|aabhar|kem|chho|chhe|nathi|sarun|avjo|su|tamari|kaho|vaat)\b/i.test(lower)) {
    return "gu";
  }
  if (/\b(sat sri akal|satsriakal|haanji|dasso|kiddan|changa|veere|haye|tuhada|tussi|gal)\b/i.test(lower)) {
    return "pa";
  }
  if (/\b(namaskar|kasa|ahe|sang|mala|karun|taka|dhanyawad|kuthe|chalel|tumi|bolu|shakto|bolto)\b/i.test(lower)) {
    return "mr";
  }
  if (/\b(adaab|assalamu|alarehman|shukriya|khuda hafiz|janaab|farmayein|kijiye|dastiyab)\b/i.test(lower)) {
    return "ur";
  }
  if (
    /\b(namaste|haan|nahi|kya|kyun|theek|shukriya|bol sakte|aap|kaise|mujhe|humko|karo|batao|batayein|chalega|bahar|karunga|alvida|badhai|dhanyawad|suno|kijiye|boliye|bolo|bol|sakte|hain)\b/i.test(
      lower
    )
  ) {
    return "hi";
  }

  return null;
}

export type LanguageSwitchResult =
  | {
      isSwitch: true;
      targetLang: VoiceLang;
      targetLanguage: VoiceLang;
      bcp47: string;
      matchedPhrase?: string;
    }
  | {
      isSwitch: false;
      targetLang?: undefined;
      targetLanguage?: undefined;
      bcp47?: undefined;
      matchedPhrase?: undefined;
    };

const LANGUAGE_SWITCH_PATTERNS: {
  lang: VoiceLang;
  names: RegExp;
}[] = [
  {
    lang: "en",
    names:
      /\b(english|angrezi|angrezee|ingreji|inglish)\b|(इंग्लिश|अंग्रेजी|अंग्रेज़ी|इंग्रजी|इंगलिश|ஆங்கிலம்|இங்லீஷ்|ఇంగ్లీష్|ఇంగ్లీషు|ಇಂಗ್ಲಿಷ್|ഇംഗ്ലീഷ്|ઇંગ્લિશ|અંગ્રેજી|ਅੰਗਰੇਜ਼ੀ|ਇੰਗਲਿਸ਼|انگریزی|انگلیش)/i,
  },
  {
    lang: "hi",
    names:
      /\b(hindi|hindustani)\b|(हिंदी|हिन्दी|இந்தி|హిందీ|ಹಿಂದಿ|ഹിന്ദി|હિન્દી|હિંદી|ਹਿੰਦੀ|ہندی)/i,
  },
  {
    lang: "mr",
    names: /\b(marathi|marathit|marathitil)\b|(मराठी|मराठीत|मराठीमध्ये)/i,
  },
  {
    lang: "ta",
    names: /\b(tamil|tamizh|tamizhil)\b|(தமிழ்|தமிழில்)/i,
  },
  {
    lang: "te",
    names: /\b(telugu|telugulo)\b|(తెలుగు|తెలుగులో)/i,
  },
  {
    lang: "kn",
    names: /\b(kannada|kannadalli|kannadadalli)\b|(ಕನ್ನಡ|ಕನ್ನಡದಲ್ಲಿ)/i,
  },
  {
    lang: "gu",
    names: /\b(gujarati|gujarathi|gujrati)\b|(ગુજરાતી|ગુજરાતીમાં)/i,
  },
  {
    lang: "pa",
    names: /\b(punjabi|panjabi)\b|(ਪੰਜਾਬੀ|ਪੰਜਾਬੀ ਵਿੱਚ)/i,
  },
  {
    lang: "ml",
    names: /\b(malayalam|malayalathil)\b|(മലയാളം|മലയാളത്തിൽ)/i,
  },
  {
    lang: "ur",
    names: /\b(urdu)\b|(اردو)/i,
  },
];

const INTENT_INDICATORS =
  /\b(speak|talk|switch|change|continue|converse|language|bhasha|boli|gal|matladu|matladandi|mathadi|maathadi|pesu|pesunga|samsarikkoo|samsarikka|vaat|baat|bolo|bol|boliye|bola|karo|in|mein|me|lo|alli|la|il|vich|please|actually|can you|could you|let's|only|now|start)\b|(बात|बोल|बोलो|बोलिए|बोला|भाषा|टॉक|स्पीक|स्विच|चेंज|में|एक्चुअली|कृपया|जरा|करा|माట్లాడండి|பேசுங்கள்|ಮಾತನಾಡಿ|సంభాషించండి|ಮಾತನಾಡು|વાત|ਗੱਲ|گفتگو)/i;

/**
 * Robustly parses spoken user utterances across all 10 Indian languages for explicit
 * language-switch control commands, including transliterated/Devanagari forms (e.g. "एक्चुअली यू टॉक इन इंग्लिश").
 */
export function parseLanguageSwitchCommand(text: string): LanguageSwitchResult {
  if (!text || !text.trim()) return { isSwitch: false };
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Exclude booking queries (e.g. "English train ticket from Mumbai to Delhi")
  const hasJourneyKeywords = /\b(ticket|train|tatkal|quota|station|pnr|berth|fare|coach|book|from|to)\b/i.test(lower);

  for (const entry of LANGUAGE_SWITCH_PATTERNS) {
    if (entry.names.test(trimmed)) {
      const hasIntent = INTENT_INDICATORS.test(trimmed);
      const isShortUtterance = trimmed.split(/\s+/).length <= 4;

      // If it contains journey keywords, only treat as switch if strong switch intent is present
      if (hasJourneyKeywords && !/\b(switch|change|talk in|speak in|continue in|bolo|baat karo)\b/i.test(lower)) {
        continue;
      }

      if (hasIntent || isShortUtterance) {
        return {
          isSwitch: true,
          targetLang: entry.lang,
          targetLanguage: entry.lang,
          bcp47: bcp47For(entry.lang),
          matchedPhrase: trimmed,
        };
      }
    }
  }

  return { isSwitch: false };
}

/** Check if the utterance is explicitly requesting to switch spoken languages. */
export function isLanguageSwitchRequest(text: string): boolean {
  return parseLanguageSwitchCommand(text).isSwitch;
}

/** Localized UI status shown while executing the deterministic switching_language phase */
export function getSwitchingStatusLabel(targetLang: VoiceLang): string {
  switch (targetLang) {
    case "hi":
      return "हिंदी में स्विच हो रहा है…";
    case "mr":
      return "मराठीत स्विच होत आहे…";
    case "ta":
      return "தமிழுக்கு மாறுகிறது…";
    case "te":
      return "తెలుగులోకి మారుతోంది…";
    case "kn":
      return "ಕನ್ನಡಕ್ಕೆ ಬದಲಾಗುತ್ತಿದೆ…";
    case "gu":
      return "ગુજરાતીમાં સ્વિચ થઈ રહ્યું છે…";
    case "pa":
      return "ਪੰਜਾਬੀ ਵਿੱਚ ਸਵਿੱਚ ਹੋ ਰਿਹਾ ਹੈ…";
    case "ml":
      return "മലയാളത്തിലേക്ക് മാറുന്നു…";
    case "ur":
      return "اردو میں تبدیل ہو رہا ہے…";
    case "en":
    default:
      return "Switching to English…";
  }
}

/**
 * Checks if the text is already primarily written in the native script of the given voice language.
 * E.g., Devanagari for Hindi / Marathi, Tamil script for Tamil, etc.
 * Avoids corrupting text that is already localized when sending to translation engines.
 */
export function isScriptForLanguage(text: string, lang: VoiceLang): boolean {
  if (!text || !text.trim()) return false;
  switch (lang) {
    case "hi":
    case "mr":
      return /[\u0900-\u097F]/.test(text);
    case "ta":
      return /[\u0B80-\u0BFF]/.test(text);
    case "te":
      return /[\u0C00-\u0C7F]/.test(text);
    case "kn":
      return /[\u0C80-\u0CFF]/.test(text);
    case "ml":
      return /[\u0D00-\u0D7F]/.test(text);
    case "gu":
      return /[\u0A80-\u0AFF]/.test(text);
    case "pa":
      return /[\u0A00-\u0A7F]/.test(text);
    case "ur":
      return /[\u0600-\u06FF]/.test(text);
    case "en":
      return !/[\u0600-\u0DFF]/.test(text);
    default:
      return false;
  }
}

export interface LanguageDialoguePack {
  switchAck: string;
  briefingMessage: string;
  yesAvailableLabel: string;
  yesAvailableResponse: string;
  allGoodLabel: string;
  farewellResponse: string;
  outsideLabel: string;
  outsideResponse: string;
  authorizeLabel: string;
  confirmDetailsLabel?: string;
  confirmDetailsResponse?: string;
  haveNiceDayLabel?: string;
}

export const LANGUAGE_DIALOGUES: Record<VoiceLang, LanguageDialoguePack> = {
  en: {
    switchAck: "Certainly! I will speak with you in English.",
    briefingMessage:
      "Hello! This is Aarav from Tatkal Copilot. Your Tatkal window opens in 5 minutes at 10:00 AM sharp. Will you be available to approve the booking when the window opens?",
    yesAvailableLabel: "Yes, I'll be available.",
    yesAvailableResponse:
      "Wonderful! I have your train details locked in and I'll keep everything primed for your 1-tap approval right when the window opens. Are there any other questions you have about the booking, or would you like to make any last-minute changes?",
    allGoodLabel: "No questions, all set! Thank you.",
    farewellResponse:
      "Thank you so much! Have a wonderful day ahead, and I'll keep a sharp watch for your booking. Goodbye!",
    outsideLabel: "No, I'm outside. I won't be able to log in.",
    outsideResponse:
      "Understood, don't worry at all! I can take over and execute the booking autonomously so you don't miss out, but I will need your one-time permission. Would you like me to open the authorization screen for you right now?",
    authorizeLabel: "Yes, please take over and open permission.",
    confirmDetailsLabel: "Can you confirm my passenger and boarding details?",
    confirmDetailsResponse:
      "All set! Your passengers, class, and train details are fully verified. Thank you, have a pleasant journey, and goodbye!",
    haveNiceDayLabel: "Everything looks great. Have a nice day!",
  },
  hi: {
    switchAck: "हाँ बिल्कुल! मैं हिन्दी में बात करूँगा।",
    briefingMessage:
      "नमस्ते! मैं तत्काल कोपायलट से आरव बोल रहा हूँ। आपकी तत्काल विंडो 5 मिनट में ठीक 10:00 बजे खुलेगी। क्या आप बुकिंग को मंज़ूरी देने के लिए उपलब्ध रहेंगे?",
    yesAvailableLabel: "हाँ, मैं उपलब्ध रहूँगा।",
    yesAvailableResponse:
      "बहुत बढ़िया! मैंने आपकी ट्रेन डिटेल्स सुरक्षित कर ली हैं और तत्काल विंडो खुलते ही 1-टैप अप्रूवल के लिए सब तैयार रखूँगा। क्या आपका कोई और सवाल है, या कोई आखिरी बदलाव करना चाहेंगे?",
    allGoodLabel: "कोई सवाल नहीं, सब ठीक है! शुक्रिया।",
    farewellResponse:
      "बहुत-बहुत शुक्रिया! आपका दिन शुभ हो, और मैं आपकी बुकिंग का पूरा ध्यान रखूँगा। अलविदा!",
    outsideLabel: "नहीं, मैं बाहर हूँ। मैं लॉग इन नहीं कर पाऊँगा।",
    outsideResponse:
      "समझ गया, बिल्कुल चिंता मत कीजिए! मैं आपकी जगह ऑटोनॉमस बुकिंग कर सकता हूँ ताकी टिकट मिस ना हो, लेकिन मुझे आपकी एक बार अनुमति चाहिए होगी। क्या मैं अभी ऑथराइजेशन स्क्रीन खोलूँ?",
    authorizeLabel: "हाँ, कृपया टेक ओवर करें और परमिशन स्क्रीन खोलें।",
    confirmDetailsLabel: "क्या आप मेरी यात्री और ट्रेन डिटेल्स कन्फर्म कर सकते हैं?",
    confirmDetailsResponse:
      "बिल्कुल! आपके सभी यात्रियों और ट्रेन की डिटेल्स सत्यापित हैं। बहुत-बहुत शुक्रिया, आपकी यात्रा मंगलमय हो और अलविदा!",
    haveNiceDayLabel: "सब कुछ बहुत अच्छा लग रहा है। आपका दिन शुभ हो!",
  },
  ta: {
    switchAck: "நிச்சயமாக! நான் தமிழில் பேசுகிறேன்.",
    briefingMessage:
      "வணக்கம்! நான் தட்கல் கோபைலட்டிலிருந்து ஆரவ். உங்கள் தட்கல் விண்டோ 5 நிமிடங்களில் திறக்கப்பட உள்ளது. முன்பதிவுக்கு ஒப்புதல் அளிக்க நீங்கள் தயாராக இருப்பீர்களா?",
    yesAvailableLabel: "ஆம், நான் கிடைப்பேன்.",
    yesAvailableResponse:
      "அருமை! உங்கள் ரயில் விவரங்கள் உறுதி செய்யப்பட்டுள்ளன. ஏதேனும் கேள்விகள் உள்ளதா அல்லது மாற்றங்கள் செய்ய வேண்டுமா?",
    allGoodLabel: "கேள்விகள் இல்லை, எல்லாம் சரி! நன்றி.",
    farewellResponse:
      "மிக்க நன்றி! உங்கள் பயணம் சிறக்க வாழ்த்துகள். விடைபெறுகிறேன்!",
    outsideLabel: "இல்லை, நான் வெளியே இருக்கிறேன். லாகின் செய்ய முடியாது.",
    outsideResponse:
      "புரிந்தது, கவலை வேண்டாம்! உங்கள் சார்பாக நான் தானாகவே புக் செய்ய முடியும், இதற்கு உங்கள் அனுமதி தேவை. அனுமதி திரையைத் திறக்கலாமா?",
    authorizeLabel: "ஆம், தயவுசெய்து அனுமதி திரையைத் திறக்கவும்.",
    confirmDetailsLabel: "பயணிகள் மற்றும் ரயில் விவரங்களை உறுதிப்படுத்த முடியுமா?",
    confirmDetailsResponse:
      "அனைத்தும் சரிபார்க்கப்பட்டது! உங்கள் பயணம் சிறப்பாக அமைய வாழ்த்துகள். நன்றி, விடைபெறுகிறேன்!",
    haveNiceDayLabel: "அனைத்தும் நன்றாக உள்ளது. நல்ல நாளாக அமையட்டும்!",
  },
  mr: {
    switchAck: "हो नक्कीच! मी मराठीत बोलतो.",
    briefingMessage:
      "नमस्कार! मी तत्काळ कोपायलटवरून आरव बोलतोय. आपली तत्काळ विंडो 5 मिनिटांत ठीक 10:00 वाजता उघडणार आहे. बुकिंग मंजूर करण्यासाठी आपण उपलब्ध असाल का?",
    yesAvailableLabel: "हो, मी उपलब्ध असेन.",
    yesAvailableResponse:
      "उत्तम! मी आपल्या ट्रेनचे सर्व तपशील तयार ठेवले आहेत. आपल्या मनात काही प्रश्न आहेत का, किंवा काही बदल करायचे आहेत का?",
    allGoodLabel: "काही प्रश्न नाही, सर्व तयार! धन्यवाद.",
    farewellResponse:
      "खूप खूप धन्यवाद! आपला दिवस आनंदाचा जावो आणि प्रवासासाठी शुभेच्छा. काळजी घ्या आणि अलविदा!",
    outsideLabel: "नाही, मी बाहेर आहे. मला लॉग इन करता येणार नाही.",
    outsideResponse:
      "समजले, काळजी करू नका! मी आपल्या वतीने ऑटोमॅटिक बुकिंग करू शकतो, फक्त आपल्या परवानगीची आवश्यकता आहे. ऑथोरायझेशन स्क्रीन उघडू का?",
    authorizeLabel: "हो, कृपया परवानगी स्क्रीन उघडा.",
    confirmDetailsLabel: "प्रवासी आणि ट्रेनचे तपशील कन्फर्म करू शकता का?",
    confirmDetailsResponse:
      "सर्व तपशील तपासले आहेत! प्रवासासाठी खूप खूप शुभेच्छा. धन्यवाद आणि अलविदा!",
    haveNiceDayLabel: "सर्व काही छान आहे. आपला दिवस चांगला जावो!",
  },
  kn: {
    switchAck: "ಖಂಡಿತವಾಗಿಯೂ! ನಾನು ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡುತ್ತೇನೆ.",
    briefingMessage:
      "ನಮಸ್ಕಾರ! ನಾನು ತತ್ಕಾಲ್ ಕೋಪೈಲಟ್‌ನಿಂದ ಆರವ್. ನಿಮ್ಮ ತತ್ಕಾಲ್ ಬುಕಿಂಗ್ ವಿಂಡೋ 5 ನಿಮಿಷಗಳಲ್ಲಿ ತೆರೆಯುತ್ತದೆ. ಬುಕಿಂಗ್ ಅನುಮೋದಿಸಲು ನೀವು ಲಭ್ಯವಿರುತ್ತೀರಾ?",
    yesAvailableLabel: "ಹೌದು, ನಾನು ಲಭ್ಯವಿರುತ್ತೇನೆ.",
    yesAvailableResponse:
      "ಉತ್ತಮ! ನಿಮ್ಮ ರೈಲಿನ ಎಲ್ಲಾ ವಿವರಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಿದ್ದೇನೆ. ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳಿವೆಯೇ ಅಥವಾ ಕೊನೆಯ ಕ್ಷಣದ ಬದಲಾವಣೆಗಳಿವೆಯೇ?",
    allGoodLabel: "ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳಿಲ್ಲ, ಎಲ್ಲಾ ಸಿದ್ಧ! ಧನ್ಯವಾದಗಳು.",
    farewellResponse:
      "ತುಂಬಾ ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ದಿನ ಶುಭವಾಗಿರಲಿ ಮತ್ತು ಸುರಕ್ಷಿತ ಪ್ರಯಾಣವಾಗಲಿ. ವಿದಾಯ!",
    outsideLabel: "ಇಲ್ಲ, ನಾನು ಹೊರಗಿದ್ದೇನೆ. ಲಾಗಿನ್ ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ.",
    outsideResponse:
      "ಅರ್ಥವಾಯಿತು, ಚಿಂತಿಸಬೇಡಿ! ನಿಮ್ಮ ಪರವಾಗಿ ನಾನು ತತ್ಕಾಲ್ ಬುಕ್ ಮಾಡಬಲ್ಲೆ, ಆದರೆ ನಿಮ್ಮ ಅನುಮತಿ ಬೇಕು. ಅನುಮತಿ ಸ್ಕ್ರೀನ್ ತೆರೆಯಲೇ?",
    authorizeLabel: "ಹೌದು, ದಯವಿಟ್ಟು ಅನುಮತಿ ಸ್ಕ್ರೀನ್ ತೆರೆಯಿರಿ.",
    confirmDetailsLabel: "ಪ್ರಯಾಣಿಕರ ಮತ್ತು ರೈಲಿನ ವಿವರಗಳನ್ನು ದೃಢೀಕರಿಸಬಹುದೇ?",
    confirmDetailsResponse:
      "ಎಲ್ಲವೂ ಪರಿಶೀಲಿಸಲಾಗಿದೆ! ನಿಮ್ಮ ಪ್ರಯಾಣ ಸುಖಕರವಾಗಿರಲಿ. ಧನ್ಯವಾದಗಳು ಮತ್ತು ವಿದಾಯ!",
    haveNiceDayLabel: "ಎಲ್ಲವೂ ಉತ್ತಮವಾಗಿದೆ. ಶುಭ ದಿನ!",
  },
  te: {
    switchAck: "తప్పకుండా! నేను తెలుగులో మాట్లాడతాను.",
    briefingMessage:
      "నమస్కారం! నేను తత్కాల్ కోపైలట్ నుండి ఆరవ్. మీ తత్కాల్ విండో 5 నిమిషాల్లో తెరవబడుతుంది. బుకింగ్ ఆమోదించడానికి మీరు అందుబాటులో ఉంటారా?",
    yesAvailableLabel: "అవును, నేను అందుబాటులో ఉంటాను.",
    yesAvailableResponse:
      "చాలా బాగుంది! మీ రైలు వివరాలను సిద్ధం చేశాను. మీకు ఏవైనా ప్రశ్నలు ఉన్నాయా లేదా ఏవైనా మార్పులు చేయాలనుకుంటున్నారా?",
    allGoodLabel: "ప్రశ్నలు లేవు, అంతా సిద్ధం! ధన్యవాదాలు.",
    farewellResponse:
      "చాలా ధన్యవాదాలు! మీ రోజు శుభప్రదంగా ఉండాలని కోరుకుంటున్నాను. సెలవు!",
    outsideLabel: "లేదు, నేను బయట ఉన్నాను. లాగిన్ చేయలేను.",
    outsideResponse:
      "అర్థమైంది, అస్సలు ఆందోళన చెందకండి! మీ అనుమతితో నేను స్వయంచాలకంగా బుక్ చేస్తాను. అనుమతి స్క్రీన్ తెరవమంటారా?",
    authorizeLabel: "అవును, దయచేసి అనుమతి స్క్రీన్ తెరవండి.",
    confirmDetailsLabel: "ప్రయాణీకుల మరియు రైలు వివరాలను ధృవీకరించగలరా?",
    confirmDetailsResponse:
      "అన్నీ ధృవీకరించబడ్డాయి! మీ ప్రయాణం సురక్షితంగా సాగాలని కోరుకుంటున్నాను. ధన్యవాదాలు మరియు సెలవు!",
    haveNiceDayLabel: "అంతా బాగుంది. మీకు మంచి రోజు కలగాలి!",
  },
  gu: {
    switchAck: "હા ચોક્કસ! હું ગુજરાતીમાં વાત કરીશ.",
    briefingMessage:
      "નમસ્તે! હું તત્કાલ કોપાયલોટમાંથી આરવ છું. તમારી તત્કાલ વિન્ડો 5 મિનિટમાં ખૂલશે. શું તમે બુકિંગ મંજૂર કરવા માટે ઉપલબ્ધ રહેશો?",
    yesAvailableLabel: "હા, હું ઉપલબ્ધ રહીશ.",
    yesAvailableResponse:
      "ખૂબ સરસ! તમારી ટ્રેનની વિગતો તૈયાર છે. શું તમને કોઈ પ્રશ્ન છે અથવા કોઈ છેલ્લી ઘડીનો ફેરફાર કરવો છે?",
    allGoodLabel: "કોઈ પ્રશ્ન નથી, બધું બરાબર! આભાર.",
    farewellResponse:
      "ખૂબ ખૂબ આભાર! તમારો દિવસ શુભ રહે અને યાત્રા મંગલમય બને. આવજો!",
    outsideLabel: "ના, હું બહાર છું. લૉગ ઇન નહીં કરી શકું.",
    outsideResponse:
      "સમજી ગયો, ચિંતા કરશો નહીં! હું તમારા વતી ઑટોમેટિક બુકિંગ કરી શકું છું, ફક્ત તમારી પરવાનગી જોઈએ છે. સ્ક્રીન ખોલું?",
    authorizeLabel: "હા, મહેરબાની કરીને પરવાનગી સ્ક્રીન ખોલો.",
    confirmDetailsLabel: "શું તમે મુસાફરો અને ટ્રેનની વિગતો કન્ફર્મ કરી શકો છો?",
    confirmDetailsResponse:
      "બધી વિગતો ચકાસી લીધી છે! તમારી યાત્રા મંગલમય રહે. ખૂબ ખૂબ આભાર અને આવજો!",
    haveNiceDayLabel: "બધું બરાબર છે. તમારો દિવસ સારો રહે!",
  },
  ml: {
    switchAck: "തീർച്ചയായും! ഞാൻ മലയാളത്തിൽ സംസാരിക്കാം.",
    briefingMessage:
      "നമസ്കാരം! ഞാൻ തത്കാൽ കോപൈലറ്റിൽ നിന്നുള്ള ആരവ് ആണ്. നിങ്ങളുടെ തത്കാൽ വിൻഡോ 5 മിനിറ്റിനുള്ളിൽ തുറക്കും. ബുക്കിംഗ് അംഗീകരിക്കാൻ നിങ്ങൾ ലഭ്യമായിരിക്കുമോ?",
    yesAvailableLabel: "അതെ, ഞാൻ ലഭ്യമായിരിക്കും.",
    yesAvailableResponse:
      "വളരെ നല്ലത്! നിങ്ങളുടെ ട്രെയിൻ വിവരങ്ങൾ പൂർണ്ണമായി ലോക്ക് ചെയ്തിട്ടുണ്ട്. എന്തെങ്കിലും സംശയങ്ങളുണ്ടോ അല്ലെങ്കിൽ എന്തെങ്കിലും മാറ്റങ്ങൾ വരുത്തണമോ?",
    allGoodLabel: "സംശയങ്ങളൊന്നുമില്ല, എല്ലാം റെഡി! നന്ദി.",
    farewellResponse:
      "വളരെ നന്ദി! നല്ലൊരു ദിവസം ആശംസിക്കുന്നു, യാത്ര സുഖകരമാകട്ടെ. വിട!",
    outsideLabel: "അല്ല, ഞാൻ പുറത്താണ്. ലോഗിൻ ചെയ്യാൻ കഴിയില്ല.",
    outsideResponse:
      "മനസ്സിലായി, ഒട്ടും വിഷമിക്കേണ്ട! എനിക്ക് നിങ്ങൾക്കായി ഓട്ടോണമസ് ആയി ബുക്ക് ചെയ്യാൻ കഴിയും, നിങ്ങളുടെ അനുമതി വേണം. അനുമതി സ്ക്രീൻ തുറക്കട്ടെ?",
    authorizeLabel: "അതെ, ദയവായി അനുമതി സ്ക്രീൻ തുറക്കൂ.",
    confirmDetailsLabel: "യാത്രക്കാരുടെയും ട്രെയിനിന്റെയും വിവരങ്ങൾ സ്ഥിരീകരിക്കാമോ?",
    confirmDetailsResponse:
      "എല്ലാം പരിശോധിച്ചു കഴിഞ്ഞു! നിങ്ങളുടെ യാത്ര സുഖകരമാകട്ടെ. നന്ദി, വിട!",
    haveNiceDayLabel: "എല്ലാം നന്നായിരിക്കുന്നു. നല്ലൊരു ദിവസം ആശംസിക്കുന്നു!",
  },
  pa: {
    switchAck: "ਹਾਂਜੀ ਬਿਲਕੁਲ! ਮੈਂ ਪੰਜਾਬੀ ਵਿੱਚ ਗੱਲ ਕਰਾਂਗਾ।",
    briefingMessage:
      "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤਤਕਾਲ ਕੋਪਾਇਲਟ ਤੋਂ ਆਰਵ ਹਾਂ। ਤੁਹਾਡੀ ਤਤਕਾਲ ਵਿੰਡੋ 5 ਮਿੰਟਾਂ ਵਿੱਚ ਖੁੱਲ੍ਹਣ ਵਾਲੀ ਹੈ। ਕੀ ਤੁਸੀਂ ਬੁਕਿੰਗ ਮਨਜ਼ੂਰ ਕਰਨ ਲਈ ਉਪਲਬਧ ਰਹੋਗੇ?",
    yesAvailableLabel: "ਹਾਂਜੀ, ਮੈਂ ਉਪਲਬਧ ਰਹਾਂਗਾ।",
    yesAvailableResponse:
      "ਬਹੁਤ ਵਧੀਆ! ਮੈਂ ਤੁਹਾਡੀ ਟ੍ਰੇਨ ਦੀ ਸਾਰੀ ਜਾਣਕਾਰੀ ਤਿਆਰ ਰੱਖੀ ਹੈ। ਕੀ ਤੁਹਾਡਾ ਕੋਈ ਸਵਾਲ ਹੈ ਜਾਂ ਕੋਈ ਆਖਰੀ ਬਦਲਾਅ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?",
    allGoodLabel: "ਕੋਈ ਸਵਾਲ ਨਹੀਂ, ਸਭ ਠੀਕ ਹੈ! ਧੰਨਵਾਦ।",
    farewellResponse:
      "ਬਹੁਤ-ਬਹੁਤ ਧੰਨਵਾਦ! ਤੁਹਾਡਾ ਦਿਨ ਸ਼ੁਭ ਰਹੇ ਅਤੇ ਸਫ਼ਰ ਸੁਖਾਵਾਂ ਹੋਵੇ। ਅਲਵਿਦਾ!",
    outsideLabel: "ਨਹੀਂ, ਮੈਂ ਬਾਹਰ ਹਾਂ। ਮੈਂ ਲੌਗਇਨ ਨਹੀਂ ਕਰ ਸਕਾਂਗਾ।",
    outsideResponse:
      "ਸਮਝ ਗਿਆ ਜੀ, ਚਿੰਤਾ ਨਾ ਕਰੋ! ਮੈਂ ਤੁਹਾਡੇ ਵੱਲੋਂ ਆਪੇ ਬੁਕਿੰਗ ਕਰ ਸਕਦਾ ਹਾਂ, ਪਰ ਮੈਨੂੰ ਤੁਹਾਡੀ ਇਜਾਜ਼ਤ ਚਾਹੀਦੀ ਹੈ। ਕੀ ਮੈਂ ਸਕ੍ਰੀਨ ਖੋਲ੍ਹਾਂ?",
    authorizeLabel: "ਹਾਂਜੀ, ਕਿਰਪਾ ਕਰਕੇ ਇਜਾਜ਼ਤ ਸਕ੍ਰੀਨ ਖੋਲ੍ਹੋ।",
    confirmDetailsLabel: "ਕੀ ਤੁਸੀਂ ਯਾਤਰੀਆਂ ਅਤੇ ਟ੍ਰੇਨ ਦੇ ਵੇਰਵਿਆਂ ਦੀ ਪੁਸ਼ਟੀ ਕਰ ਸਕਦੇ ਹੋ?",
    confirmDetailsResponse:
      "ਸਾਰੇ ਵੇਰਵੇ ਚੈੱਕ ਕਰ ਲਏ ਹਨ! ਤੁਹਾਡਾ ਸਫ਼ਰ ਸੁਖਾਵਾਂ ਹੋਵੇ। ਧੰਨਵਾਦ ਅਤੇ ਅਲਵਿਦਾ!",
    haveNiceDayLabel: "ਸਭ ਕੁਝ ਬਹੁਤ ਵਧੀਆ ਹੈ। ਤੁਹਾਡਾ ਦਿਨ ਸ਼ੁਭ ਰਹੇ!",
  },
  ur: {
    switchAck: "ہاں بالکل! میں اردو میں بات کروں گا۔",
    briefingMessage:
      "آداب! میں تتکال کوپائلٹ سے آرو ہوں۔ آپ کی تتکال ونڈو 5 منٹ میں کھلنے والی ہے۔ کیا آپ بکنگ منظور کرنے کے لیے دستیاب ہوں گے؟",
    yesAvailableLabel: "ہاں، میں دستیاب رہوں گا۔",
    yesAvailableResponse:
      "بہت خوب! میں نے آپ کی ٹرین کی تفصیلات محفوظ کر لی ہیں۔ کیا آپ کا کوئی اور سوال ہے، یا کوئی آخری تبدیلی کرنا چاہیں گے؟",
    allGoodLabel: "کوئی سوال نہیں، سب ٹھیک ہے! شکریہ۔",
    farewellResponse:
      "بہت شکریہ! آپ کا دن اچھا گزرے، خدا حافظ!",
    outsideLabel: "نہیں، میں باہر ہوں۔ میں لاگ ان نہیں کر پاؤں گا۔",
    outsideResponse:
      "سمجھ گیا، بالکل فکر نہ کریں! میں آپ کی جگہ خودکار بکنگ کر سکتا ہوں، بس آپ کی اجازت درکار ہے۔ کیا میں اجازت کی اسکرین کھولوں؟",
    authorizeLabel: "ہاں، براہ کرم اجازت کی اسکرین کھولیں۔",
    confirmDetailsLabel: "کیا آپ مسافروں اور ٹرین کی تفصیلات کی تصدیق کر سکتے ہیں؟",
    confirmDetailsResponse:
      "تمام تفصیلات کی تصدیق ہو چکی ہے! آپ کا سفر خوشگوار رہے، بہت شکریہ اور خدا حافظ!",
    haveNiceDayLabel: "سب کچھ بہت اچھا ہے۔ آپ کا دن اچھا گزرے!",
  },
};

export function getLanguageDialogue(lang: VoiceLang): LanguageDialoguePack {
  return LANGUAGE_DIALOGUES[lang] ?? LANGUAGE_DIALOGUES.en;
}

