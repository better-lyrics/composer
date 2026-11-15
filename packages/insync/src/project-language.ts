const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language", fallback: "code" });

function normalizeLanguageTag(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  try {
    return Intl.getCanonicalLocales(trimmed)[0];
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

function isValidLanguageTag(input: string): boolean {
  return normalizeLanguageTag(input) !== undefined;
}

function languageName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code;
}

export { isValidLanguageTag, languageName, normalizeLanguageTag };
