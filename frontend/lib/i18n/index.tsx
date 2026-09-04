"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { dictionaries } from "./dictionaries";

export type Locale = "ar" | "en";

interface I18nContextType {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function lookup(dict: any, key: string): unknown {
  return key.split(".").reduce((acc: any, part) => (acc == null ? undefined : acc[part]), dict);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("locale") as Locale | null) : null;
    if (saved === "ar" || saved === "en") setLocaleState(saved);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") localStorage.setItem("locale", next);
  };

  const toggleLocale = () => setLocale(locale === "ar" ? "en" : "ar");

  const t = (key: string, vars?: Record<string, string | number>) => {
    let value = lookup((dictionaries as any)[locale], key);
    if (value == null) value = lookup((dictionaries as any).ar, key);
    if (typeof value !== "string") return key;
    if (vars) {
      return Object.entries(vars).reduce(
        (str, [k, v]) => str.replaceAll(`{${k}}`, String(v)),
        value
      );
    }
    return value;
  };

  return (
    <I18nContext.Provider
      value={{ locale, dir: locale === "ar" ? "rtl" : "ltr", setLocale, toggleLocale, t }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
