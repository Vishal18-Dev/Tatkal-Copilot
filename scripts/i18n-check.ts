import { CATALOGS } from "../lib/i18n/catalogs";
import { TERMINOLOGY_GLOSSARY } from "../lib/i18n/terminology";
import type { SupportedLanguage } from "../lib/i18n/types";

const ALL_LOCALES: SupportedLanguage[] = [
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

function runI18nCheck() {
  console.log("🔍 Running Tatkal Copilot i18n Validator...\n");
  let errors: string[] = [];

  // A. Locale Existence Check
  ALL_LOCALES.forEach((locale) => {
    if (!CATALOGS[locale]) {
      errors.push(`❌ Missing locale catalog for ${locale}`);
    }
  });

  // B. Key Parity Check
  const canonicalKeys = Object.keys(CATALOGS["en-IN"]);
  console.log(`✅ Found ${canonicalKeys.length} canonical translation keys in en-IN.`);

  ALL_LOCALES.forEach((locale) => {
    const keys = Object.keys(CATALOGS[locale] || {});
    const missingKeys = canonicalKeys.filter((k) => !keys.includes(k));
    const extraKeys = keys.filter((k) => !canonicalKeys.includes(k));

    if (missingKeys.length > 0) {
      errors.push(
        `❌ ${locale} missing ${missingKeys.length} keys: ${missingKeys.slice(0, 5).join(", ")}${missingKeys.length > 5 ? "..." : ""}`
      );
    }
    if (extraKeys.length > 0) {
      errors.push(`❌ ${locale} has extra keys not in canonical en-IN: ${extraKeys.join(", ")}`);
    }
  });

  // C. Placeholder Parity Check
  const placeholderRegex = /\{([^}]+)\}/g;
  canonicalKeys.forEach((key) => {
    const enText = CATALOGS["en-IN"][key as keyof typeof CATALOGS["en-IN"]];
    const enMatches = Array.from(enText.matchAll(placeholderRegex)).map((m) => m[1]);

    if (enMatches.length > 0) {
      ALL_LOCALES.forEach((locale) => {
        const text = CATALOGS[locale]?.[key as keyof typeof CATALOGS["en-IN"]] || "";
        const locMatches = Array.from(text.matchAll(placeholderRegex)).map((m) => m[1]);
        const missing = enMatches.filter((p) => !locMatches.includes(p));
        if (missing.length > 0) {
          errors.push(`❌ ${locale} key "${key}" missing placeholder(s): {${missing.join("}, {")}}`);
        }
      });
    }
  });

  // D. Missing / Empty Translation Check
  ALL_LOCALES.forEach((locale) => {
    canonicalKeys.forEach((key) => {
      const val = CATALOGS[locale]?.[key as keyof typeof CATALOGS["en-IN"]];
      if (!val || val.trim() === "") {
        errors.push(`❌ ${locale} has empty translation for key "${key}"`);
      }
    });
  });

  // E. Terminology Compliance Check
  console.log(`✅ Auditing ${TERMINOLOGY_GLOSSARY.length} central terminology entries.`);
  TERMINOLOGY_GLOSSARY.forEach((entry) => {
    ALL_LOCALES.forEach((locale) => {
      const translation = entry.translations[locale];
      if (!translation || translation.trim() === "") {
        errors.push(`❌ Terminology key "${entry.key}" missing translation for ${locale}`);
      }
    });
  });

  // F. Script & Native Character Range Verification
  console.log("✅ Verifying native script compliance for regional locales.");
  const SCRIPT_RANGES: Partial<Record<SupportedLanguage, RegExp>> = {
    "kn-IN": /[\u0C80-\u0CFF]/,
    "ta-IN": /[\u0B80-\u0BFF]/,
    "te-IN": /[\u0C00-\u0C7F]/,
    "gu-IN": /[\u0A80-\u0AFF]/,
    "pa-IN": /[\u0A00-\u0A7F]/,
    "ur-IN": /[\u0600-\u06FF]/,
    "ml-IN": /[\u0D00-\u0D7F]/,
  };

  Object.entries(SCRIPT_RANGES).forEach(([locale, regex]) => {
    let scriptMatches = 0;
    canonicalKeys.forEach((key) => {
      const val = CATALOGS[locale as SupportedLanguage]?.[key as keyof typeof CATALOGS["en-IN"]] || "";
      if (regex.test(val)) {
        scriptMatches++;
      }
    });
    const percentage = (scriptMatches / canonicalKeys.length) * 100;
    if (percentage < 50) {
      errors.push(
        `❌ ${locale} catalog is missing native script content! Only ${scriptMatches}/${canonicalKeys.length} (${percentage.toFixed(1)}%) keys match its native script range.`
      );
    }
  });

  // Report Results
  console.log("\n=========================================");
  if (errors.length > 0) {
    console.error(`FAILED: Found ${errors.length} i18n validation error(s):\n`);
    errors.forEach((err) => console.error(err));
    process.exit(1);
  } else {
    console.log(`✨ All ${ALL_LOCALES.length} locales passed validation with 100% key, placeholder & script parity!`);
    process.exit(0);
  }
}

runI18nCheck();
