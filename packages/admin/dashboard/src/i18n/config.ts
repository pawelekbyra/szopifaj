import { InitOptions } from "i18next"

export const defaultI18nOptions: InitOptions = {
  debug: process.env.NODE_ENV === "development",
  detection: {
    // Polski jest domyślny (2026-07-17) — nie wykrywamy języka z nagłówka
    // przeglądarki (Accept-Language), żeby obcojęzyczna przeglądarka nie
    // nadpisywała domyślnego PL. Wybór języka trwa tylko przez jawny wybór
    // w ustawieniach (cookie/localStorage), nie przez zgadywanie.
    caches: ["cookie", "localStorage"],
    lookupCookie: "lng",
    lookupLocalStorage: "lng",
    order: ["cookie", "localStorage"],
  },
  fallbackLng: "pl",
  fallbackNS: "translation",
  interpolation: {
    escapeValue: false,
  },
}
