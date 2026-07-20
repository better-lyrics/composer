const LANGUAGE_OPTIONS = [
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["pt", "Portuguese"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh-Hans", "Chinese (Simplified)"],
  ["zh-Hant", "Chinese (Traditional)"],
  ["ar", "Arabic"],
  ["hi", "Hindi"],
  ["ru", "Russian"],
  ["tr", "Turkish"],
  ["vi", "Vietnamese"],
] as const;

const SOURCE_LANGUAGE_OPTIONS = [
  ["", "Auto-detect"],
  ...LANGUAGE_OPTIONS,
  ["th", "Thai"],
  ["el", "Greek"],
  ["he", "Hebrew"],
  ["bn", "Bengali"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
] as const;

export { LANGUAGE_OPTIONS, SOURCE_LANGUAGE_OPTIONS };
