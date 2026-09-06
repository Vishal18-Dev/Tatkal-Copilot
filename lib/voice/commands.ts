import type { SemanticCommandIntent, VoiceCommand, VoiceCommandKind } from "./types";
import type { VoiceLang } from "./languages";

/* ============================================================
   Multilingual Voice Command Engine across 10 Indian Languages:
   1. English    (en)
   2. Hindi      (hi)
   3. Marathi    (mr)
   4. Kannada    (kn)
   5. Tamil      (ta)
   6. Telugu     (te)
   7. Gujarati   (gu)
   8. Punjabi    (pa)
   9. Urdu       (ur)
   10. Malayalam (ml)

   Supported Semantic Intents:
   - YES      (Affirmation)
   - NO       (Negative rejection)
   - CANCEL   (Dismissal/abort)
   - REPEAT   (Re-read / say again)
   - CONFIRM  (Action authorization / book / select)
   - BACKUP   (Alternative / plan b query or switch)
   - CHEAPER  (Budget adjustment)
   - CHANGE   (Reset / modify search)
   - STOP     (Halt speech / pause)
   ============================================================ */

export const INTENT_TO_KIND: Record<SemanticCommandIntent, VoiceCommandKind> = {
  yes: "confirm",
  confirm: "confirm",
  no: "reject",
  cancel: "cancel",
  stop: "cancel",
  repeat: "repeat",
  backup: "backup",
  cheaper: "cheaper",
  change: "change",
  unknown: "unknown",
};

interface CommandPattern {
  intent: SemanticCommandIntent;
  lang: VoiceLang;
  words: string[];
}

const COMMAND_DICTIONARY: CommandPattern[] = [
  // ──────────────────────────── ENGLISH ────────────────────────────
  {
    intent: "yes",
    lang: "en",
    words: ["yes", "yeah", "yep", "yup", "sure", "correct", "ok", "okay", "fine", "definitely", "absolutely", "sounds good", "that works"],
  },
  {
    intent: "no",
    lang: "en",
    words: ["no", "nope", "nah", "not this", "not that one", "wrong one", "don't want that", "not now", "negative", "disagree"],
  },
  {
    intent: "cancel",
    lang: "en",
    words: ["cancel", "dismiss", "never mind", "nevermind", "forget it", "drop it", "abort"],
  },
  {
    intent: "repeat",
    lang: "en",
    words: ["repeat", "repeat that", "say that again", "say again", "come again", "what was that", "pardon", "again", "tell me again"],
  },
  {
    intent: "confirm",
    lang: "en",
    words: ["confirm", "choose it", "select it", "book it", "do it", "go ahead", "proceed", "lock it in", "finalize", "book this train"],
  },
  {
    intent: "backup",
    lang: "en",
    words: ["backup", "plan b", "alternative", "second option", "backup train", "backup option", "other train", "alternate route"],
  },
  {
    intent: "cheaper",
    lang: "en",
    words: ["cheaper", "cheapest", "budget", "lowest fare", "less expensive", "low cost", "cheap", "lower price"],
  },
  {
    intent: "change",
    lang: "en",
    words: ["change", "modify", "different train", "switch", "start over", "change plan", "different option", "search again"],
  },
  {
    intent: "stop",
    lang: "en",
    words: ["stop", "pause", "hold on", "wait", "shut down", "halt", "be quiet"],
  },

  // ──────────────────────────── HINDI ────────────────────────────
  {
    intent: "yes",
    lang: "hi",
    words: ["हाँ", "हां", "जी हाँ", "हाँजी", "ठीक है", "theek hai", "haan", "haanji", "sahi hai", "achha", "bilkul", "thik hai"],
  },
  {
    intent: "no",
    lang: "hi",
    words: ["नहीं", "नही", "ना", "nahi", "nahin", "na", "nahi chahiye", "galat"],
  },
  {
    intent: "cancel",
    lang: "hi",
    words: ["रद्द करो", "कैंसिल", "छोड़ो", "radd karo", "chhodo", "cancel karo", "mat karo", "hatao"],
  },
  {
    intent: "repeat",
    lang: "hi",
    words: ["दोबारा बताओ", "फिर से बोलो", "दोबारा", "फिर से", "dobara bolo", "phir se", "dobara batao", "dubara", "phir batao"],
  },
  {
    intent: "confirm",
    lang: "hi",
    words: ["पक्का करो", "कर दो", "बुक करो", "इसे चुनो", "आगे बढ़ो", "pakka karo", "kar do", "book kar do", "ise chuno", "aage badho", "book karo", "confirm karo"],
  },
  {
    intent: "backup",
    lang: "hi",
    words: ["बैकअप", "दूसरा विकल्प", "दूसरा ट्रेन", "विकल्प", "backup", "doosra vikalp", "dusri train", "alternative", "dusra rasta"],
  },
  {
    intent: "cheaper",
    lang: "hi",
    words: ["सस्ता", "कम किराया", "कम पैसा", "सस्ती टिकट", "sasta", "kam kiraya", "kam paisa", "kam kharcha", "sasti", "kam daam"],
  },
  {
    intent: "change",
    lang: "hi",
    words: ["बदलो", "बदलना है", "दूसरा देखो", "बदल दो", "badlo", "badalna hai", "change karo", "dusra dikhao"],
  },
  {
    intent: "stop",
    lang: "hi",
    words: ["रुको", "रोको", "रुकिए", "बंद करो", "ruko", "roko", "rukiye", "band karo", "ruk jao"],
  },

  // ──────────────────────────── MARATHI ────────────────────────────
  {
    intent: "yes",
    lang: "mr",
    words: ["हो", "होय", "नक्की", "चालेल", "बरोबर", "hoy", "ho", "chalel", "barobar", "nakki"],
  },
  {
    intent: "no",
    lang: "mr",
    words: ["नाही", "नको", "नकोय", "naahi", "nako", "nahi", "nakoy"],
  },
  {
    intent: "cancel",
    lang: "mr",
    words: ["रद्द करा", "सोडून द्या", "नको आता", "radd kara", "sodun dya", "cancel kara"],
  },
  {
    intent: "repeat",
    lang: "mr",
    words: ["पुन्हा सांगा", "परत बोला", "पुन्हा", "परत सांगा", "punha sanga", "parat bola", "punha", "parat sanga"],
  },
  {
    intent: "confirm",
    lang: "mr",
    words: ["नक्की करा", "निवडा", "बुक करा", "पुढे चला", "हेच निवडा", "nakki kara", "pudhe chala", "book kara", "nivada", "confirm kara"],
  },
  {
    intent: "backup",
    lang: "mr",
    words: ["पर्याय", "दुसरा पर्याय", "बॅकअप", "दुसरी ट्रेन", "paryay", "dusra paryay", "backup", "dusri train"],
  },
  {
    intent: "cheaper",
    lang: "mr",
    words: ["स्वस्त", "कमी भाडे", "कमी खर्च", "svasta", "swast", "kami bhade", "kami kharch"],
  },
  {
    intent: "change",
    lang: "mr",
    words: ["बदला", "दुसरे काही", "बदल करा", "वेगळे दाखवा", "badla", "badal kara", "vegle dakhva", "change kara"],
  },
  {
    intent: "stop",
    lang: "mr",
    words: ["थांबा", "बंद करा", "असाच थांबा", "thamba", "band kara"],
  },

  // ──────────────────────────── KANNADA ────────────────────────────
  {
    intent: "yes",
    lang: "kn",
    words: ["ಹೌದು", "ಸರಿ", "ಖಂಡಿತ", "ಆಗಲಿ", "haudu", "sari", "khanditha", "aagali"],
  },
  {
    intent: "no",
    lang: "kn",
    words: ["ಇಲ್ಲ", "ಬೇಡ", "ಇಲ್ಲ ಬೇಡ", "illa", "beda", "illa beda"],
  },
  {
    intent: "cancel",
    lang: "kn",
    words: ["ರದ್ದು ಮಾಡಿ", "ರದ್ದುಮಾಡಿ", "ರದ್ದುಗೊಳಿಸು", "ಬೇಡ ಬಿಡಿ", "raddu maadi", "cancel maadi", "beda bidi"],
  },
  {
    intent: "repeat",
    lang: "kn",
    words: ["ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ", "ಇನ್ನೊಮ್ಮೆ ಹೇಳಿ", "ಮತ್ತೆ ಹೇಳಿ", "mattomme heli", "innomme heli", "matte heli"],
  },
  {
    intent: "confirm",
    lang: "kn",
    words: ["ಖಚಿತಪಡಿಸಿ", "ಆರಿಸಿ", "ಬುಕ್ ಮಾಡಿ", "ಮುಂದುವರಿಯಿರಿ", "ಇದನ್ನೇ ಆರಿಸಿ", "khachitapadisi", "aarisi", "book maadi", "munduvariyiri", "confirm maadi"],
  },
  {
    intent: "backup",
    lang: "kn",
    words: ["ಪರ್ಯಾಯ", "ಬ್ಯಾಕಪ್", "ಬೇರೆ ರೈಲು", "ಇನ್ನೊಂದು ರೈಲು", "paryaaya", "backup", "bere railu", "innondhu train"],
  },
  {
    intent: "cheaper",
    lang: "kn",
    words: ["ಕಡಿಮೆ ದರ", "ಅಗ್ಗದ", "ಕಡಿಮೆ ಬೆಲೆ", "ಕಡಿಮೆ ಖರ್ಚು", "kadime dara", "aggada", "kadime bele", "kadime kharchu"],
  },
  {
    intent: "change",
    lang: "kn",
    words: ["ಬದಲಾಯಿಸಿ", "ಬೇರೆ ನೋಡಿ", "ಬದಲಾವಣೆ", "badalayisi", "bere nodi", "change maadi"],
  },
  {
    intent: "stop",
    lang: "kn",
    words: ["ನಿಲ್ಲಿಸಿ", "ತಡಿ", "ಕಾದುನೋಡು", "ಸಾಕು", "nillisi", "thadi", "saaku"],
  },

  // ──────────────────────────── TAMIL ────────────────────────────
  {
    intent: "yes",
    lang: "ta",
    words: ["ஆம்", "சரி", "ஆமாம்", "நிச்சயமாக", "aam", "aamaa", "aamaam", "sari", "nichayamaaga"],
  },
  {
    intent: "no",
    lang: "ta",
    words: ["இல்லை", "வேண்டாம்", "இல்ல", "illai", "vendaam", "illa", "venda"],
  },
  {
    intent: "cancel",
    lang: "ta",
    words: ["ரத்து செய்", "வேண்டாம் விட்டுடு", "விட்டுடு", "rathu sei", "cancel sei", "vittudu", "vendam vittudu"],
  },
  {
    intent: "repeat",
    lang: "ta",
    words: ["மீண்டும் சொல்லுங்கள்", "மறுபடியும் சொல்லு", "மறுபடியும்", "திரும்ப சொல்லு", "meendum sollungal", "marubadiyum sollu", "marupadiyum", "thirumba sollu"],
  },
  {
    intent: "confirm",
    lang: "ta",
    words: ["உறுதி செய்", "பதிவு செய்", "இதை தேர்வு செய்", "முன்னேறு", "urudhi sei", "pathivu sei", "idhai therndhedu", "confirm pannu", "confirm pannunga", "munneru"],
  },
  {
    intent: "backup",
    lang: "ta",
    words: ["மாற்று ரயில்", "பேக்கப்", "வேறு வழி", "மாற்று வழி", "maattru rail", "backup", "veru vazhi", "maattru vazhi"],
  },
  {
    intent: "cheaper",
    lang: "ta",
    words: ["குறைந்த கட்டணம்", "மலிவான", "விலை குறைவு", "கம்மியான", "kuraindha kattanam", "malivaana", "vilai kuraivu", "kammiyaana"],
  },
  {
    intent: "change",
    lang: "ta",
    words: ["மாற்று", "வேறு காட்டு", "மாத்தணும்", "மாத்து", "maattru", "veru kaattu", "maathanum", "maathu", "change pannu"],
  },
  {
    intent: "stop",
    lang: "ta",
    words: ["நிறுத்து", "நில்லு", "காத்திரு", "போதும்", "niruthu", "nillu", "poru", "podhum"],
  },

  // ──────────────────────────── TELUGU ────────────────────────────
  {
    intent: "yes",
    lang: "te",
    words: ["అవును", "సరే", "ఖచ్చితంగా", "సరిగ్గా", "avunu", "sare", "avunandi", "khachithanga"],
  },
  {
    intent: "no",
    lang: "te",
    words: ["కాదు", "వద్దు", "లేదు", "kaadu", "vaddu", "ledu"],
  },
  {
    intent: "cancel",
    lang: "te",
    words: ["రద్దు చేయండి", "రద్దు", "వద్దు ఆపేయండి", "raddu cheyandi", "cancel cheyandi", "vaddu aapeyandi"],
  },
  {
    intent: "repeat",
    lang: "te",
    words: ["మళ్ళీ చెప్పండి", "మరోసారి చెప్పండి", "మళ్ళీ", "malli cheppandi", "marosari cheppandi", "malli"],
  },
  {
    intent: "confirm",
    lang: "te",
    words: ["ధృవీకరించండి", "ఎంచుకోండి", "బుక్ చేయండి", "ముందుకు వెళ్లండి", "dhruveekarinchandi", "enchukondi", "book cheyandi", "munduku vellandi", "confirm cheyandi"],
  },
  {
    intent: "backup",
    lang: "te",
    words: ["ప్రత్యామ్నాయం", "బ్యాకప్", "మరొక రైలు", "వేరే రైలు", "prathyamnayam", "backup", "maroka train", "vere train"],
  },
  {
    intent: "cheaper",
    lang: "te",
    words: ["తక్కువ ధర", "చౌకగా", "తక్కువ ఖర్చు", "thakkuva dhara", "chaukaga", "thakkuva kharchu"],
  },
  {
    intent: "change",
    lang: "te",
    words: ["మార్చండి", "వేరేది చూపించండి", "మార్పు", "maarchandi", "veredi chupinchandi", "change cheyandi"],
  },
  {
    intent: "stop",
    lang: "te",
    words: ["ఆపండి", "ఆగండి", "ఆగు", "చాలు", "aapandi", "aagandi", "aagu", "chaalu"],
  },

  // ──────────────────────────── GUJARATI ────────────────────────────
  {
    intent: "yes",
    lang: "gu",
    words: ["હા", "બરાબર", "ચોક્કસ", "સારું", "haa", "barabar", "chokkas", "saaru"],
  },
  {
    intent: "no",
    lang: "gu",
    words: ["ના", "નથી", "નથી જોઈતું", "naa", "nathi", "nathi joiye"],
  },
  {
    intent: "cancel",
    lang: "gu",
    words: ["રદ કરો", "કેન્સલ કરો", "છોડી દો", "rad karo", "cancel karo", "chhodi do"],
  },
  {
    intent: "repeat",
    lang: "gu",
    words: ["ફરીથી કહો", "ફરી બોલો", "ફરીથી", "farithi kaho", "fari bolo", "farithi"],
  },
  {
    intent: "confirm",
    lang: "gu",
    words: ["પાકું કરો", "પસંદ કરો", "બુક કરો", "આગળ વધો", "આ પસંદ કરો", "paaku karo", "pasand karo", "book karo", "aagal vadho", "confirm karo"],
  },
  {
    intent: "backup",
    lang: "gu",
    words: ["વિકલ્પ", "બીજો વિકલ્પ", "બીજી ટ્રેન", "બેકઅપ", "vikalp", "beejo vikalp", "backup", "beeji train"],
  },
  {
    intent: "cheaper",
    lang: "gu",
    words: ["સસ્તું", "ઓછું ભાડું", "ઓછા પૈસા", "ઓછો ખર્ચ", "sastu", "ochhu bhaadu", "ochha paisa", "ochho kharch"],
  },
  {
    intent: "change",
    lang: "gu",
    words: ["બદલો", "બીજું બતાવો", "ફેરફાર કરો", "badlo", "change karo", "ferfar karo", "beeju batavo"],
  },
  {
    intent: "stop",
    lang: "gu",
    words: ["રોકો", "થાંભો", "અટકો", "બંધ કરો", "roko", "thambho", "atko", "bandh karo"],
  },

  // ──────────────────────────── PUNJABI ────────────────────────────
  {
    intent: "yes",
    lang: "pa",
    words: ["ਹਾਂ", "ਹਾਂਜੀ", "ਠੀਕ ਹੈ", "ਸਹੀ ਹੈ", "haan", "haanji", "theek hai", "sahi hai"],
  },
  {
    intent: "no",
    lang: "pa",
    words: ["ਨਹੀਂ", "ਨਾ", "ਨਹੀਂ ਚਾਹੀਦਾ", "nahi", "nahin", "na", "nahi chahida"],
  },
  {
    intent: "cancel",
    lang: "pa",
    words: ["ਰੱਦ ਕਰੋ", "ਛੱਡੋ", "ਕੈਂਸਲ ਕਰੋ", "radd karo", "chhaddo", "cancel karo"],
  },
  {
    intent: "repeat",
    lang: "pa",
    words: ["ਦੁਬਾਰਾ ਦੱਸੋ", "ਫਿਰ ਬੋਲੋ", "ਮੁੜ ਦੱਸੋ", "dubara dasso", "phir bolo", "mudo dasso"],
  },
  {
    intent: "confirm",
    lang: "pa",
    words: ["ਪੱਕਾ ਕਰੋ", "ਚੁਣੋ", "ਬੁੱਕ ਕਰੋ", "ਅੱਗੇ ਵਧੋ", "ਇਹ ਬੁੱਕ ਕਰੋ", "pakka karo", "chuno", "book karo", "agge vadho", "confirm karo"],
  },
  {
    intent: "backup",
    lang: "pa",
    words: ["ਦੂਜਾ ਵਿਕਲਪ", "ਬੈਕਅੱਪ", "ਦੂਜੀ ਟਰੇਨ", "ਹੋਰ ਟਰੇਨ", "dooja vikalp", "backup", "dooji train", "hor train"],
  },
  {
    intent: "cheaper",
    lang: "pa",
    words: ["ਸਸਤਾ", "ਘੱਟ ਕਿਰਾਇਆ", "ਘੱਟ ਖਰਚਾ", "ਸਸਤੀ ਟਿਕਟ", "sasta", "ghatt kiraya", "ghatt kharcha", "sasti ticket"],
  },
  {
    intent: "change",
    lang: "pa",
    words: ["ਬਦਲੋ", "ਕੁਝ ਹੋਰ", "ਦੂਜਾ ਦਿਖਾਓ", "badlo", "change karo", "kujh hor", "dooja dikhao"],
  },
  {
    intent: "stop",
    lang: "pa",
    words: ["ਰੁਕੋ", "ਥੰਮ੍ਹੋ", "ਬੰਦ ਕਰੋ", "ਖਲੋਵੋ", "ruko", "thammo", "band karo", "khalovo"],
  },

  // ──────────────────────────── URDU ────────────────────────────
  {
    intent: "yes",
    lang: "ur",
    words: ["ہاں", "جی ہاں", "ٹھیک ہے", "صحیح", "بالکل", "haan", "jee haan", "theek hai", "sahi", "bilkul"],
  },
  {
    intent: "no",
    lang: "ur",
    words: ["نہیں", "نہ", "نہیں چاہیے", "غلط", "nahi", "nahin", "na", "nahi chahiye"],
  },
  {
    intent: "cancel",
    lang: "ur",
    words: ["منسوخ کریں", "چھوڑیں", "کینسل کریں", "mansookh karein", "chhorein", "cancel karein"],
  },
  {
    intent: "repeat",
    lang: "ur",
    words: ["دوبارہ بتائیں", "پھر سے کہیں", "دوبارہ", "dobara batayein", "phir se kahein", "dobara"],
  },
  {
    intent: "confirm",
    lang: "ur",
    words: ["تصدیق کریں", "بک کریں", "چن لیں", "آگے بڑھیں", "یہ بک کریں", "tasdeeq karein", "book karein", "chun lein", "aage barhein", "confirm karein"],
  },
  {
    intent: "backup",
    lang: "ur",
    words: ["متبادل", "دوسرا راستہ", "بیک اپ", "دوسری ٹرین", "mutabadil", "doosra rasta", "backup", "doosri train"],
  },
  {
    intent: "cheaper",
    lang: "ur",
    words: ["سستا", "کم کرایہ", "کم قیمت", "سستی ٹکٹ", "sasta", "kam kiraya", "kam qeemat", "sasti ticket"],
  },
  {
    intent: "change",
    lang: "ur",
    words: ["بدلیں", "تبدیل کریں", "دوسرا دکھائیں", "badlein", "tabdeel karein", "change karein", "doosra dikhayein"],
  },
  {
    intent: "stop",
    lang: "ur",
    words: ["روکیں", "ٹھہریں", "رک جائیں", "بند کریں", "rokein", "thehrein", "ruk jayein", "band karein"],
  },

  // ──────────────────────────── MALAYALAM ────────────────────────────
  {
    intent: "yes",
    lang: "ml",
    words: ["അതെ", "ശരി", "തീർച്ചയായും", "ശരിയാണ്", "athe", "shari", "theerchayayum", "shariyaanu"],
  },
  {
    intent: "no",
    lang: "ml",
    words: ["അല്ല", "വേണ്ട", "ഇല്ല", "alla", "venda", "illa", "vendaa"],
  },
  {
    intent: "cancel",
    lang: "ml",
    words: ["റദ്ദാക്കുക", "റദ്ദാക്കൂ", "വേണ്ട ഒഴിവാക്കൂ", "raddakkuka", "raddakku", "cancel cheyyu", "ozhivakku"],
  },
  {
    intent: "repeat",
    lang: "ml",
    words: ["വീണ്ടും പറയൂ", "ഒന്നുകൂടി പറയൂ", "വീണ്ടും", "veendum parayoo", "onnukoodi parayoo"],
  },
  {
    intent: "confirm",
    lang: "ml",
    words: ["ഉറപ്പിക്കൂ", "തിരഞ്ഞെടുക്കൂ", "ബുക്ക് ചെയ്യൂ", "മുന്നോട്ട് പോകൂ", "ഇത് തിരഞ്ഞെടുക്കൂ", "urappikku", "thiranjedukkoo", "book cheyyu", "munnotte pokoo", "confirm cheyyu"],
  },
  {
    intent: "backup",
    lang: "ml",
    words: ["മറ്റൊരു ട്രെയിൻ", "ബാക്കപ്പ്", "മറ്റൊരു വഴി", "രണ്ടാമത്തെ വഴി", "mattoru train", "backup", "mattoru vazhi", "randamathe vazhi"],
  },
  {
    intent: "cheaper",
    lang: "ml",
    words: ["ചിലവ് കുറഞ്ഞത്", "കുറഞ്ഞ നിരക്ക്", "വില കുറഞ്ഞ", "കുറഞ്ഞ ചിലവ്", "chilavu kuranjathu", "kuranja nirakku", "vila kuranja"],
  },
  {
    intent: "change",
    lang: "ml",
    words: ["മാറ്റൂ", "വേറെ കാണിക്കൂ", "മാറ്റം വരുത്തൂ", "maattoo", "change cheyyu", "vere kaanikkoo"],
  },
  {
    intent: "stop",
    lang: "ml",
    words: ["നിർത്തൂ", "നിൽക്കൂ", "മതി", "നില്ല്", "nirthoo", "nilkkoo", "mathi", "nillu"],
  },
];

function phraseMatches(norm: string, phrase: string): boolean {
  const p = phrase.toLowerCase().trim();
  if (!p) return false;
  if (p.includes(" ")) return norm.includes(p);

  // Single Latin words: strict word boundary \b so "no" doesn't trigger inside "know"
  if (/^[a-z0-9]+$/i.test(p)) {
    return new RegExp(`\\b${p}\\b`, "i").test(norm);
  }

  // Non-Latin Indic script words: match with token boundary (start/end or whitespace/punctuation)
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundaryRegex = new RegExp(`(^|\\s|[.,!?;:'"“”’])${escaped}($|\\s|[.,!?;:'"“”’])`, "i");
  return boundaryRegex.test(norm);
}

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"“”’]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Classify a spoken utterance into a normalized semantic voice command across
 * all 10 supported Indian languages.
 *
 * Language Resolution Priority:
 * 1. preferredLang (explicit user selection or Sarvam-detected language)
 * 2. Utterance native script / lexical match
 * 3. Fallback across all languages (code-switching)
 *
 * If the utterance matches mutually conflicting kinds (e.g. affirmative + rejection),
 * it safely returns "unknown" to prevent accidental unintended actions.
 */
export function parseVoiceCommand(
  text: string,
  preferredLang?: VoiceLang | null
): VoiceCommand {
  const norm = normalize(text);
  if (!norm) {
    return { kind: "unknown", intent: "unknown", raw: text, confidence: 0 };
  }

  interface MatchRecord {
    intent: SemanticCommandIntent;
    kind: VoiceCommandKind;
    lang: VoiceLang;
    matchedWord: string;
  }

  const rawMatches: MatchRecord[] = [];

  for (const entry of COMMAND_DICTIONARY) {
    for (const w of entry.words) {
      if (phraseMatches(norm, w)) {
        rawMatches.push({
          intent: entry.intent,
          kind: INTENT_TO_KIND[entry.intent],
          lang: entry.lang,
          matchedWord: w.toLowerCase().trim(),
        });
        break; // matched this entry, move to next
      }
    }
  }

  if (rawMatches.length === 0) {
    return { kind: "unknown", intent: "unknown", raw: text, confidence: 0 };
  }

  // Subsumption filter:
  // If a shorter match's word is strictly a substring of a longer match's word,
  // the longer match is more specific and subsumes the shorter one (e.g. "വേண்டாம் விட்டுடு" over "வேண்டாம்", or "மாற்று ரயில்" over "மாற்று").
  const matches = rawMatches.filter(
    (m1) =>
      !rawMatches.some(
        (m2) =>
          m2 !== m1 &&
          m2.matchedWord.length > m1.matchedWord.length &&
          m2.matchedWord.includes(m1.matchedWord)
      )
  );

  // Check for mutual conflicts:
  // e.g. confirm vs reject, or confirm vs cancel
  const distinctKinds = new Set(matches.map((m) => m.kind));
  if (distinctKinds.size > 1) {
    // Distinct action kinds conflict — do not guess
    return { kind: "unknown", intent: "unknown", raw: text, confidence: 0 };
  }

  // All matches belong to the same overarching kind!
  const commonKind = [...distinctKinds][0];

  // Resolve the most specific intent among aligned matches
  // E.g. If both "yes" and "confirm" match, pick "confirm"
  // E.g. If both "stop" and "cancel" match, pick "cancel"
  let primaryIntent = matches[0].intent;
  if (matches.some((m) => m.intent === "confirm")) primaryIntent = "confirm";
  else if (matches.some((m) => m.intent === "cancel")) primaryIntent = "cancel";
  else if (matches.some((m) => m.intent === "stop")) primaryIntent = "stop";
  else if (matches.some((m) => m.intent === "yes")) primaryIntent = "yes";

  // Resolve language:
  // 1. If preferredLang is among the matches, prioritize it
  // 2. Otherwise pick the language of the first matching word
  const preferredMatch = preferredLang ? matches.find((m) => m.lang === preferredLang) : null;
  const resolvedLang = preferredMatch ? preferredMatch.lang : matches[0].lang;

  return {
    kind: commonKind,
    intent: primaryIntent,
    raw: text,
    language: resolvedLang,
    confidence: preferredMatch ? 1.0 : 0.95,
  };
}
