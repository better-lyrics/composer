import { useSettingsStore } from "@/stores/settings";
import { escapeRegex } from "@/utils/escape-regex";

// -- Helpers ------------------------------------------------------------------

function getSplitCharacter(): string {
  return useSettingsStore.getState().splitCharacter;
}

interface SplitCharacterPatterns {
  leading: RegExp;
  trailing: RegExp;
  consecutive: RegExp;
  every: RegExp;
  cleaned: Map<string, string>;
}

const MAX_CLEANED_ENTRIES = 8192;

const patternsBySplitCharacter = new Map<string, SplitCharacterPatterns>();

function patternsFor(splitCharacter: string): SplitCharacterPatterns {
  let patterns = patternsBySplitCharacter.get(splitCharacter);
  if (!patterns) {
    const escaped = escapeRegex(splitCharacter);
    patterns = {
      leading: new RegExp(`^${escaped}+`),
      trailing: new RegExp(`${escaped}+$`),
      consecutive: new RegExp(`${escaped}{2,}`, "g"),
      every: new RegExp(escaped, "g"),
      cleaned: new Map(),
    };
    patternsBySplitCharacter.set(splitCharacter, patterns);
  }
  return patterns;
}

function cleanSplitCharacters(text: string, char?: string): string {
  const c = char ?? getSplitCharacter();
  const { leading, trailing, consecutive, every, cleaned: cache } = patternsFor(c);
  const known = cache.get(text);
  if (known !== undefined) return known;

  const result = text
    .split(/\s+/)
    .flatMap((token) => {
      if (token.length === 0) return [];
      const cleaned = token.replace(leading, "").replace(trailing, "").replace(consecutive, c);
      const final = cleaned || token.replace(every, "");
      return final ? [final] : [];
    })
    .join(" ");

  if (cache.size >= MAX_CLEANED_ENTRIES) cache.clear();
  cache.set(text, result);
  return result;
}

function withoutSplitCharacter(text: string, splitChar: string): string {
  return text.replaceAll(splitChar, "");
}

function stripSplitCharacter(text: string): string {
  return withoutSplitCharacter(text, getSplitCharacter());
}

// -- Exports ------------------------------------------------------------------

export { getSplitCharacter, cleanSplitCharacters, stripSplitCharacter, withoutSplitCharacter };
