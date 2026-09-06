import { describe, it, expect } from "vitest";
import { parseVoiceCommand } from "@/lib/voice/commands";
import type { VoiceLang } from "@/lib/voice/languages";
import type { SemanticCommandIntent } from "@/lib/voice/types";

describe("Genuine 10-Language Voice Command Engine (Item 2)", () => {
  const ALL_10_LANGUAGES: VoiceLang[] = ["en", "hi", "mr", "kn", "ta", "te", "gu", "pa", "ur", "ml"];

  // 1. Minimum test matrix across all 10 languages for the 9 required commands
  const commandMatrix: Record<Exclude<SemanticCommandIntent, "unknown">, Record<VoiceLang, string[]>> = {
    yes: {
      en: ["yes", "yeah", "sure", "ok", "okay"],
      hi: ["हाँ", "हां", "हाँजी", "theek hai", "haan"],
      mr: ["हो", "होय", "चालेल", "बरोबर", "hoy"],
      kn: ["ಹೌದು", "ಸರಿ", "ಖಂಡಿತ", "haudu", "sari"],
      ta: ["ஆம்", "சரி", "ஆமாம்", "aamaa", "sari"],
      te: ["అవును", "సరే", "ఖచ్చితంగా", "avunu", "sare"],
      gu: ["હા", "બરાબર", "ચોક્કસ", "haa", "barabar"],
      pa: ["ਹਾਂ", "ਹਾਂਜੀ", "ਠੀਕ ਹੈ", "haan", "theek hai"],
      ur: ["ہاں", "جی ہاں", "ٹھیک ہے", "jee haan", "theek hai"],
      ml: ["അതെ", "ശരി", "തീർച്ചയായും", "athe", "shari"],
    },
    no: {
      en: ["no", "nope", "nah", "not this"],
      hi: ["नहीं", "नही", "ना", "nahi", "nahi chahiye"],
      mr: ["नाही", "नको", "नकोय", "naahi", "nako"],
      kn: ["ಇಲ್ಲ", "ಬೇಡ", "illa", "beda"],
      ta: ["இல்லை", "வேண்டாம்", "illai", "vendaam"],
      te: ["కాదు", "వద్దు", "లేదు", "kaadu", "vaddu"],
      gu: ["ના", "નથી", "naa", "nathi"],
      pa: ["ਨਹੀਂ", "ਨਾ", "nahi", "nahin"],
      ur: ["نہیں", "نہ", "nahi", "nahin"],
      ml: ["അല്ല", "വേണ്ട", "ഇല്ല", "alla", "venda"],
    },
    cancel: {
      en: ["cancel", "dismiss", "never mind", "drop it"],
      hi: ["रद्द करो", "कैंसिल", "छोड़ो", "radd karo", "chhodo"],
      mr: ["रद्द करा", "सोडून द्या", "radd kara", "cancel kara"],
      kn: ["ರದ್ದು ಮಾಡಿ", "ಬೇಡ ಬಿಡಿ", "raddu maadi", "cancel maadi"],
      ta: ["ரத்து செய்", "வேண்டாம் விட்டுடு", "rathu sei", "cancel sei"],
      te: ["రద్దు చేయండి", "రద్దు", "raddu cheyandi", "cancel cheyandi"],
      gu: ["રદ કરો", "કેન્સલ કરો", "rad karo", "chhodi do"],
      pa: ["ਰੱਦ ਕਰੋ", "ਛੱਡੋ", "radd karo", "cancel karo"],
      ur: ["منسوخ کریں", "چھوڑیں", "mansookh karein", "cancel karein"],
      ml: ["റദ്ദാക്കുക", "റദ്ദാക്കൂ", "raddakkuka", "cancel cheyyu"],
    },
    repeat: {
      en: ["repeat", "say that again", "pardon", "again"],
      hi: ["दोबारा बताओ", "फिर से बोलो", "दोबारा", "dobara bolo", "phir se"],
      mr: ["पुन्हा सांगा", "परत बोला", "पुन्हा", "parat sanga"],
      kn: ["ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ", "ಇನ್ನೊಮ್ಮೆ ಹೇಳಿ", "mattomme heli"],
      ta: ["மீண்டும் சொல்லுங்கள்", "மறுபடியும் சொல்லு", "marubadiyum sollu"],
      te: ["మళ్ళీ చెప్పండి", "మరోసారి చెప్పండి", "malli cheppandi"],
      gu: ["ફરીથી કહો", "ફરી બોલો", "farithi kaho"],
      pa: ["ਦੁਬਾਰਾ ਦੱਸੋ", "ਫਿਰ ਬੋਲੋ", "dubara dasso"],
      ur: ["دوبارہ بتائیں", "پھر سے کہیں", "dobara batayein"],
      ml: ["വീണ്ടും പറയൂ", "ഒന്നുകൂടി പറയൂ", "veendum parayoo"],
    },
    confirm: {
      en: ["confirm", "choose it", "select it", "book it", "go ahead"],
      hi: ["पक्का करो", "कर दो", "बुक करो", "ise chuno", "pakka karo"],
      mr: ["नक्की करा", "निवडा", "बुक करा", "nakki kara", "pudhe chala"],
      kn: ["ಖಚಿತಪಡಿಸಿ", "ಆರಿಸಿ", "ಬುಕ್ ಮಾಡಿ", "khachitapadisi", "book maadi"],
      ta: ["உறுதி செய்", "பதிவு செய்", "இதை தேர்வு செய்", "urudhi sei", "confirm pannunga"],
      te: ["ధృవీకరించండి", "ఎంచుకోండి", "బుక్ చేయండి", "dhruveekarinchandi", "book cheyandi"],
      gu: ["પાકું કરો", "પસંદ કરો", "બુક કરો", "paaku karo", "book karo"],
      pa: ["ਪੱਕਾ ਕਰੋ", "ਚੁਣੋ", "ਬੁੱਕ ਕਰੋ", "pakka karo", "book karo"],
      ur: ["تصدیق کریں", "بک کریں", "چن لیں", "tasdeeq karein", "book karein"],
      ml: ["ഉറപ്പിക്കൂ", "തിരഞ്ഞെടുക്കൂ", "ബുക്ക് ചെയ്യൂ", "urappikku", "book cheyyu"],
    },
    backup: {
      en: ["backup", "plan b", "alternative", "second option"],
      hi: ["बैकअप", "दूसरा विकल्प", "dusri train", "alternative"],
      mr: ["पर्याय", "दुसरा पर्याय", "बॅकअप", "dusra paryay"],
      kn: ["ಪರ್ಯಾಯ", "ಬ್ಯಾಕಪ್", "ಬೇರೆ ರೈಲು", "paryaaya", "bere railu"],
      ta: ["மாற்று ரயில்", "பேக்கப்", "வேறு வழி", "maattru rail"],
      te: ["ప్రత్యామ్నాయం", "బ్యాకప్", "మరొక రైలు", "prathyamnayam"],
      gu: ["વિકલ્પ", "બીજો વિકલ્પ", "બેકઅપ", "beejo vikalp"],
      pa: ["ਦੂਜਾ ਵਿਕਲਪ", "ਬੈਕਅੱਪ", "ਦੂਜੀ ਟਰੇਨ", "dooja vikalp"],
      ur: ["متبادل", "دوسرا راستہ", "بیک اپ", "mutabadil"],
      ml: ["മറ്റൊരു ട്രെയിൻ", "ബാക്കപ്പ്", "മറ്റൊരു വഴി", "mattoru train"],
    },
    cheaper: {
      en: ["cheaper", "cheapest", "budget", "lowest fare"],
      hi: ["सस्ता", "कम किराया", "कम पैसा", "sasta", "kam kiraya"],
      mr: ["स्वस्त", "कमी भाडे", "कमी खर्च", "svasta", "swast"],
      kn: ["ಕಡಿಮೆ ದರ", "ಅಗ್ಗದ", "ಕಡಿಮೆ ಬೆಲೆ", "kadime dara", "aggada"],
      ta: ["குறைந்த கட்டணம்", "மலிவான", "விலை குறைவு", "kuraindha kattanam", "kammiyaana"],
      te: ["తక్కువ ధర", "చౌకగా", "తక్కువ ఖర్చు", "thakkuva dhara", "chaukaga"],
      gu: ["સસ્તું", "ઓછું ભાડું", "ઓછા પૈસા", "sastu", "ochhu bhaadu"],
      pa: ["ਸਸਤਾ", "ਘੱਟ ਕਿਰਾਇਆ", "ਘੱਟ ਖਰਚਾ", "sasta", "ghatt kiraya"],
      ur: ["سستا", "کم کرایہ", "کم قیمت", "sasta", "kam kiraya"],
      ml: ["ചിലവ് കുറഞ്ഞത്", "കുറഞ്ഞ നിരക്ക്", "വില കുറഞ്ഞ", "chilavu kuranjathu"],
    },
    change: {
      en: ["change", "modify", "different train", "switch", "start over"],
      hi: ["बदलो", "बदलना है", "दूसरा देखो", "badlo", "change karo"],
      mr: ["बदला", "दुसरे काही", "बदल करा", "badla", "change kara"],
      kn: ["ಬದಲಾಯಿಸಿ", "ಬೇರೆ ನೋಡಿ", "badalayisi", "change maadi"],
      ta: ["மாற்று", "வேறு காட்டு", "மாத்தணும்", "maattru", "change pannu"],
      te: ["మార్చండి", "వేరేది చూపించండి", "maarchandi", "change cheyandi"],
      gu: ["બદલો", "બીજું બતાવો", "ફેરફાર કરો", "badlo", "change karo"],
      pa: ["ਬਦਲੋ", "ਕੁਝ ਹੋਰ", "ਦੂਜਾ ਦਿਖਾਓ", "badlo", "change karo"],
      ur: ["بدلیں", "تبدیل کریں", "دوسرا دکھائیں", "badlein", "change karein"],
      ml: ["മാറ്റൂ", "വേറെ കാണിക്കൂ", "maattoo", "change cheyyu"],
    },
    stop: {
      en: ["stop", "pause", "hold on", "wait", "halt"],
      hi: ["रुको", "रोको", "रुकिए", "बंद करो", "ruko", "band karo"],
      mr: ["थांबा", "बंद करा", "thamba", "band kara"],
      kn: ["ನಿಲ್ಲಿಸಿ", "ತಡಿ", "ಕಾದುನೋಡು", "nillisi", "saaku"],
      ta: ["நிறுத்து", "நில்லு", "காத்திரு", "niruthu", "podhum"],
      te: ["ఆపండి", "ఆగండి", "చాలు", "aapandi", "aagandi"],
      gu: ["રોકો", "થાંભો", "અટકો", "roko", "bandh karo"],
      pa: ["ਰੁਕੋ", "ਥੰਮ੍ਹੋ", "ਬੰਦ ਕਰੋ", "ruko", "thammo"],
      ur: ["روکیں", "ٹھہریں", "رک جائیں", "rokein", "thehrein"],
      ml: ["നിർത്തൂ", "നിൽക്കൂ", "മതി", "nirthoo", "mathi"],
    },
  };

  describe("All 9 required commands across all 10 languages", () => {
    const intents: Array<Exclude<SemanticCommandIntent, "unknown">> = [
      "yes",
      "no",
      "cancel",
      "repeat",
      "confirm",
      "backup",
      "cheaper",
      "change",
      "stop",
    ];

    for (const intent of intents) {
      it(`recognizes intent "${intent}" across all 10 languages`, () => {
        for (const lang of ALL_10_LANGUAGES) {
          const phrases = commandMatrix[intent][lang];
          expect(phrases.length).toBeGreaterThan(0);
          for (const phrase of phrases) {
            const cmd = parseVoiceCommand(phrase, lang);
            expect(cmd.intent).toBe(intent);
            expect(cmd.kind).not.toBe("unknown");
          }
        }
      });
    }
  });

  describe("Language resolution & Priority", () => {
    it("respects explicit language selection when resolving ambiguous/shared terms", () => {
      // "sari" is a common affirmation in Kannada and Tamil
      const cmdKn = parseVoiceCommand("sari", "kn");
      expect(cmdKn.intent).toBe("yes");
      expect(cmdKn.language).toBe("kn");
      expect(cmdKn.confidence).toBe(1.0);

      const cmdTa = parseVoiceCommand("sari", "ta");
      expect(cmdTa.intent).toBe("yes");
      expect(cmdTa.language).toBe("ta");
      expect(cmdTa.confidence).toBe(1.0);
    });

    it("automatically detects language from unique native script tokens", () => {
      expect(parseVoiceCommand("ಹೌದು").language).toBe("kn");
      expect(parseVoiceCommand("ஆம்").language).toBe("ta");
      expect(parseVoiceCommand("അതെ").language).toBe("ml");
      expect(parseVoiceCommand("అవును").intent).toBe("yes");
      expect(parseVoiceCommand("હા").language).toBe("gu");
      expect(parseVoiceCommand("ਰੱਦ ਕਰੋ").language).toBe("pa");
      expect(parseVoiceCommand("تصدیق کریں").language).toBe("ur");
      expect(parseVoiceCommand("नक्की करा").language).toBe("mr");
    });
  });

  describe("Code-switching and Mixed Indian Expressions", () => {
    it("recognizes natural Indian code-switching with English loan words", () => {
      // Hinglish
      expect(parseVoiceCommand("haan bhai, book kar do").intent).toBe("confirm");
      expect(parseVoiceCommand("backup train option dikhao").intent).toBe("backup");
      expect(parseVoiceCommand("thoda sasta option batao").intent).toBe("cheaper");

      // Tanglish
      expect(parseVoiceCommand("sari, confirm pannunga").intent).toBe("confirm");
      expect(parseVoiceCommand("backup rail enna").intent).toBe("backup");

      // Kanglish
      expect(parseVoiceCommand("haudu, book maadi").intent).toBe("confirm");
      expect(parseVoiceCommand("swalpa kadime dara dakhva").intent).toBe("cheaper");

      // Teluglish
      expect(parseVoiceCommand("avunu, ticket book cheyandi").intent).toBe("confirm");
      expect(parseVoiceCommand("thakkuva dhara train chupinchandi").intent).toBe("cheaper");

      // Marathlish
      expect(parseVoiceCommand("hoy, book kara pudhe chala").intent).toBe("confirm");
      expect(parseVoiceCommand("swast train dakhva").intent).toBe("cheaper");

      // Gujlish
      expect(parseVoiceCommand("haa, confirm karo").intent).toBe("confirm");
      expect(parseVoiceCommand("sastu ticket batavo").intent).toBe("cheaper");

      // Malayalish
      expect(parseVoiceCommand("athe, book cheyyu").intent).toBe("confirm");
      expect(parseVoiceCommand("kuranja nirakku train kaanikkoo").intent).toBe("cheaper");

      // Punjablish
      expect(parseVoiceCommand("haanji, ticket book karo").intent).toBe("confirm");
      expect(parseVoiceCommand("sasti ticket dasso").intent).toBe("cheaper");
    });
  });

  describe("Rejection of Unknown Speech & Ambiguity Safeguards", () => {
    it("does not falsely classify general journey statements as commands", () => {
      expect(parseVoiceCommand("Mumbai to Delhi tomorrow morning").intent).toBe("unknown");
      expect(parseVoiceCommand("I want 2AC ticket for my family").intent).toBe("unknown");
      expect(parseVoiceCommand("What is the train departure time?").intent).toBe("unknown");
      expect(parseVoiceCommand("").intent).toBe("unknown");
      expect(parseVoiceCommand("   ").intent).toBe("unknown");
    });

    it("safely rejects mutually conflicting utterances across languages", () => {
      // English conflict: yes vs no
      expect(parseVoiceCommand("yes wait no").intent).toBe("unknown");
      expect(parseVoiceCommand("yes wait no").kind).toBe("unknown");

      // Tamil conflict: aamaa (yes) vs illai (no)
      expect(parseVoiceCommand("aamaa illai").intent).toBe("unknown");

      // Kannada conflict: haudu (yes) vs beda (no)
      expect(parseVoiceCommand("haudu beda").intent).toBe("unknown");

      // Telugu conflict: avunu (yes) vs vaddu (no)
      expect(parseVoiceCommand("avunu vaddu").intent).toBe("unknown");

      // Marathi conflict: hoy (yes) vs nako (no)
      expect(parseVoiceCommand("hoy nako").intent).toBe("unknown");
    });

    it("preserves semantic kind mapping for backwards compatibility", () => {
      expect(parseVoiceCommand("yes").kind).toBe("confirm");
      expect(parseVoiceCommand("confirm").kind).toBe("confirm");
      expect(parseVoiceCommand("no").kind).toBe("reject");
      expect(parseVoiceCommand("cancel").kind).toBe("cancel");
      expect(parseVoiceCommand("stop").kind).toBe("cancel");
      expect(parseVoiceCommand("repeat").kind).toBe("repeat");
      expect(parseVoiceCommand("backup").kind).toBe("backup");
      expect(parseVoiceCommand("cheaper").kind).toBe("cheaper");
      expect(parseVoiceCommand("change").kind).toBe("change");
    });
  });
});
