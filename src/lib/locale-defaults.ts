// PRS-UX-002 / NFR-010 (TCX-NEW-04): numbers and dates follow the language the customer chose in the app, not the
// browser's. toLocaleString() / toLocaleDateString() / toLocaleTimeString() called without an explicit locale fall back
// to <html lang>, which both apps keep in sync with the selected language. Currency codes stay explicit at call sites.
const appLocale = (): string | undefined => (typeof document !== "undefined" && document.documentElement.lang) || undefined;

type Loc = string | string[] | undefined;

const num = Number.prototype.toLocaleString;
Number.prototype.toLocaleString = function (this: number, locales?: Loc, options?: Intl.NumberFormatOptions) {
  return num.call(this, locales ?? appLocale(), options);
};

for (const m of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"] as const) {
  const orig = Date.prototype[m];
  Date.prototype[m] = function (this: Date, locales?: Loc, options?: Intl.DateTimeFormatOptions) {
    return orig.call(this, locales ?? appLocale(), options);
  } as typeof orig;
}

export {};
