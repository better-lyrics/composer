const SCHEMES_BY_LANG: Readonly<Record<string, readonly string[]>> = {
  ja: ["ja-Latn-hepburn", "ja-Latn-kunrei"],
  zh: ["zh-Latn-pinyin"],
  ko: ["ko-Latn-rr", "ko-Latn-mr"],
  th: ["th-Latn-rtgs"],
  ru: ["ru-Latn-iso9", "ru-Latn-bgn"],
  el: ["el-Latn-iso843"],
  ar: ["ar-Latn-iso233"],
  he: ["he-Latn"],
  hi: ["hi-Latn-iast"],
  bn: ["bn-Latn-iast"],
  und: ["und-Latn"],
};

function availableSchemesForLang(lang: string): string[] {
  return [...(SCHEMES_BY_LANG[lang] ?? SCHEMES_BY_LANG.und)];
}

function defaultSchemeForLang(lang: string): string {
  return availableSchemesForLang(lang)[0];
}

function schemeBelongsToLang(scheme: string, lang: string): boolean {
  if (!scheme) return false;
  return availableSchemesForLang(lang).includes(scheme);
}

export { availableSchemesForLang, defaultSchemeForLang, SCHEMES_BY_LANG, schemeBelongsToLang };
