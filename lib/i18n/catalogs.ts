import type { SupportedLanguage } from "./types";
import { enIN, type CatalogKey } from "../../locales/en-IN/catalog";
import { hiIN } from "../../locales/hi-IN/catalog";
import { mrIN } from "../../locales/mr-IN/catalog";
import { knIN } from "../../locales/kn-IN/catalog";
import { taIN } from "../../locales/ta-IN/catalog";
import { teIN } from "../../locales/te-IN/catalog";
import { guIN } from "../../locales/gu-IN/catalog";
import { paIN } from "../../locales/pa-IN/catalog";
import { urIN } from "../../locales/ur-IN/catalog";
import { mlIN } from "../../locales/ml-IN/catalog";

export type Dict = Record<CatalogKey, string>;

export const CATALOGS: Record<SupportedLanguage, Dict> = {
  "en-IN": enIN,
  "hi-IN": hiIN,
  "mr-IN": mrIN,
  "kn-IN": knIN,
  "ta-IN": taIN,
  "te-IN": teIN,
  "gu-IN": guIN,
  "pa-IN": paIN,
  "ur-IN": urIN,
  "ml-IN": mlIN,
};

export function getCatalog(lang: SupportedLanguage): Dict {
  return CATALOGS[lang] ?? CATALOGS["en-IN"];
}

export function translateKey(
  lang: SupportedLanguage,
  key: string,
  params?: Record<string, string | number>
): string {
  const catalog = getCatalog(lang);
  let text = (catalog as Record<string, string>)[key] ?? (enIN as Record<string, string>)[key] ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    });
  }
  return text;
}
