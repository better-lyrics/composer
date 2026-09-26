const NON_LATIN = /[^\p{Script_Extensions=Latin}\p{Script_Extensions=Common}]/u;

const SCRIPT_TO_LANGUAGE: ReadonlyArray<readonly [RegExp, string]> = [
  [/\p{Script=Hiragana}|\p{Script=Katakana}/u, "ja"],
  [/\p{Script=Hangul}/u, "ko"],
  [/\p{Script=Han}/u, "zh"],
  [/\p{Script=Cyrillic}/u, "ru"],
  [/\p{Script=Devanagari}/u, "hi"],
  [/\p{Script=Arabic}/u, "ar"],
  [/\p{Script=Thai}/u, "th"],
  [/\p{Script=Greek}/u, "el"],
  [/\p{Script=Hebrew}/u, "he"],
  [/\p{Script=Bengali}/u, "bn"],
  [/\p{Script=Tamil}/u, "ta"],
  [/\p{Script=Telugu}/u, "te"],
  [/\p{Script=Malayalam}/u, "ml"],
  [/\p{Script=Kannada}/u, "kn"],
  [/\p{Script=Gujarati}/u, "gu"],
  [/\p{Script=Gurmukhi}/u, "pa"],
  [/\p{Script=Sinhala}/u, "si"],
  [/\p{Script=Myanmar}/u, "my"],
  [/\p{Script=Georgian}/u, "ka"],
  [/\p{Script=Khmer}/u, "km"],
  [/\p{Script=Lao}/u, "lo"],
];

function containsNonLatin(text: string): boolean {
  return NON_LATIN.test(text);
}

function detectNonLatinLanguage(text: string): string | null {
  for (const [pattern, language] of SCRIPT_TO_LANGUAGE) {
    if (pattern.test(text)) return language;
  }
  return null;
}

export { containsNonLatin, detectNonLatinLanguage };
