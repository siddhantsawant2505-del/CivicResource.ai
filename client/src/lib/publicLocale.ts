import { useEffect, useState } from "react";

export type PublicLocale = "english" | "hindi" | "marathi";

const STORAGE_KEY = "civicresource.publicLocale";

const localeToLang: Record<PublicLocale, string> = {
  english: "en",
  hindi: "hi",
  marathi: "mr",
};

const validLocale = (value: string | null): value is PublicLocale => {
  return value === "english" || value === "hindi" || value === "marathi";
};

export const isIndicLocale = (locale: PublicLocale) => locale !== "english";

export const getStoredPublicLocale = (): PublicLocale => {
  if (typeof window === "undefined") return "english";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return validLocale(value) ? value : "english";
};

export const applyPublicLocaleToDocument = (locale: PublicLocale) => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = localeToLang[locale];
  document.documentElement.dataset.publicLocaleScript = isIndicLocale(locale) ? "indic" : "latin";
};

export const setStoredPublicLocale = (locale: PublicLocale) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, locale);
  }
  applyPublicLocaleToDocument(locale);
};

export const usePublicLocale = () => {
  const [locale, setLocale] = useState<PublicLocale>(() => getStoredPublicLocale());

  useEffect(() => {
    applyPublicLocaleToDocument(locale);
  }, [locale]);

  const updateLocale = (next: PublicLocale) => {
    setLocale(next);
    setStoredPublicLocale(next);
  };

  return { locale, setLocale: updateLocale, isIndic: isIndicLocale(locale) };
};
