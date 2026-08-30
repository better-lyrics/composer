import type { WordTiming } from "@/domain/word/timing";

const DASHES = /[-\u2010-\u2015]+/g;

interface TimingWordGroup {
  words: WordTiming[];
  startIndex: number;
}

function normalizeTransliterationForEditing(value: string): string {
  return value.replace(DASHES, "-").replace(/\s+/g, " ").trim();
}

function transliterationWordGroups(value: string): string[] {
  const normalized = normalizeTransliterationForEditing(value);
  return normalized ? normalized.split(" ") : [];
}

function transliterationSyllables(value: string): string[] {
  return value.split("-").filter(Boolean);
}

function transliterationForTimeline(value: string): string {
  return normalizeTransliterationForEditing(value).replace(DASHES, " ");
}

function fitTransliterationToSourceWords(sourceText: string, transliteration: string): string {
  const sourceGroups = sourceWordGroups(sourceText);
  const romanGroups = transliterationWordGroups(transliteration);
  if (sourceGroups.length === 0 || romanGroups.length <= sourceGroups.length) return transliteration;

  const totalSourceLength = sourceGroups.reduce((sum, group) => sum + [...group].length, 0);
  let sourceLength = 0;
  let romanIndex = 0;
  return sourceGroups
    .map((group, index) => {
      sourceLength += [...group].length;
      const groupsRemaining = sourceGroups.length - index - 1;
      const idealEnd = Math.round((sourceLength / totalSourceLength) * romanGroups.length);
      const end =
        groupsRemaining === 0
          ? romanGroups.length
          : Math.min(romanGroups.length - groupsRemaining, Math.max(romanIndex + 1, idealEnd));
      const fitted = romanGroups.slice(romanIndex, end).join("-");
      romanIndex = end;
      return fitted;
    })
    .join(" ");
}

function timingWordGroups(words: WordTiming[]): TimingWordGroup[] {
  const result: TimingWordGroup[] = [];
  let index = 0;
  while (index < words.length) {
    const startIndex = index;
    const id = words[index].syllableGroupId;
    index++;
    if (id !== undefined) {
      while (index < words.length && words[index].syllableGroupId === id && !words[index - 1].text.endsWith(" "))
        index++;
    }
    result.push({ words: words.slice(startIndex, index), startIndex });
  }
  return result;
}

function timingLexicalWordGroups(words: WordTiming[]): TimingWordGroup[] {
  const result: TimingWordGroup[] = [];
  let startIndex = 0;
  for (let index = 0; index < words.length; index++) {
    if (!words[index].text.endsWith(" ") && index < words.length - 1) continue;
    result.push({ words: words.slice(startIndex, index + 1), startIndex });
    startIndex = index + 1;
  }
  return result;
}

function sourceWordGroups(originalText: string): string[] {
  return originalText.trim().split(/\s+/).filter(Boolean);
}

function sourceWordCount(originalText: string): number {
  return sourceWordGroups(originalText).length;
}

function validateTransliterationAlignment(
  originalText: string,
  transliteration: string,
  words?: WordTiming[],
): string | null {
  if (!transliteration.trim()) return null;
  const romanGroups = transliterationWordGroups(transliteration);
  // Syllable group IDs can legitimately change inside one displayed word. The
  // transliteration's space-separated groups follow lexical boundaries instead,
  // which are encoded by trailing spaces in the timing text.
  const sourceGroups = words?.length ? timingLexicalWordGroups(words) : [];
  const expectedWords = sourceWordCount(originalText);
  if (romanGroups.length !== expectedWords) {
    return `Expected ${expectedWords} word ${expectedWords === 1 ? "group" : "groups"}, found ${romanGroups.length}. Use spaces between words.`;
  }
  let lexicalIndex = 0;
  for (const sourceGroup of sourceGroups) {
    const sourceText = sourceGroup.words.map((word) => word.text).join("");
    const lexicalWordsInGroup = Math.max(1, sourceWordCount(sourceText));
    const slots = sourceGroup.words.length;
    if (slots <= 1 || lexicalWordsInGroup !== 1) {
      lexicalIndex += lexicalWordsInGroup;
      continue;
    }
    const romanGroup = romanGroups[lexicalIndex];
    if (romanGroup === undefined) {
      return "Timed word boundaries do not align with the transliteration word groups.";
    }
    const syllables = transliterationSyllables(romanGroup).length;
    if (syllables !== slots) {
      return `Original word ${lexicalIndex + 1} is split into ${slots} timed syllables, but its transliteration has ${syllables} dash-separated ${syllables === 1 ? "syllable" : "syllables"}.`;
    }
    lexicalIndex += lexicalWordsInGroup;
  }
  return null;
}

function hasLexicalBoundaryAfter(words: WordTiming[], index: number): boolean {
  if (index >= words.length - 1) return false;
  if (words[index].text.endsWith(" ")) return true;
  const id = words[index].syllableGroupId;
  const nextId = words[index + 1].syllableGroupId;
  if (id !== undefined || nextId !== undefined) return id !== nextId;
  return words[index].text.endsWith(" ");
}

export {
  hasLexicalBoundaryAfter,
  fitTransliterationToSourceWords,
  normalizeTransliterationForEditing,
  sourceWordGroups,
  sourceWordCount,
  timingWordGroups,
  transliterationForTimeline,
  transliterationSyllables,
  transliterationWordGroups,
  validateTransliterationAlignment,
};
export type { TimingWordGroup };
