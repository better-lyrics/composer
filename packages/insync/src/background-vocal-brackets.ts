import { wordFromSpaced } from "./word-spaced-words";
import type { WordTiming } from "./word-timing";

// -- Trailing space accessors -------------------------------------------------

function stripTrailingSpace(s: string): string {
  return s.replace(/ +$/, "");
}

function trailingSpaceOf(s: string): string {
  const m = s.match(/ +$/);
  return m ? m[0] : "";
}

// -- Word-list bracket wrapping -----------------------------------------------

function bracketWordList(words: WordTiming[]): WordTiming[] {
  if (words.length === 0) return words;
  if (words.length === 1) {
    const only = words[0];
    const spaced = only.text + only.sep;
    return [wordFromSpaced({ ...only, text: `(${stripTrailingSpace(spaced)})${trailingSpaceOf(spaced)}` })];
  }
  const first = words[0];
  const last = words[words.length - 1];
  const lastSpaced = last.text + last.sep;
  const out = [...words];
  out[0] = { ...first, text: `(${first.text}` };
  out[out.length - 1] = wordFromSpaced({
    ...last,
    text: `${stripTrailingSpace(lastSpaced)})${trailingSpaceOf(lastSpaced)}`,
  });
  return out;
}

// -- Separators ---------------------------------------------------------------

type BackgroundSeparator = "space" | "comma";

interface BracketJoin {
  preserveBrackets: boolean;
  separator: BackgroundSeparator;
}

const SEPARATOR_MARK: Record<BackgroundSeparator, string> = { space: "", comma: "," };

// A part that already ends in the mark is not given a second one.
function joinExtractedParts(parts: readonly string[], separator: BackgroundSeparator): string {
  return parts.reduce((joined, part, index) => (index === 0 ? part : `${withMark(joined, separator)} ${part}`), "");
}

function withMark(text: string, separator: BackgroundSeparator): string {
  const mark = SEPARATOR_MARK[separator];
  return text.trimEnd().endsWith(mark) ? text.trimEnd() : `${text}${mark}`;
}

// -- Parts --------------------------------------------------------------------

function hasBalancedBrackets(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === "(") depth++;
    else if (char === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

const hasBalancedPairs = (text: string) => text.includes("(") && hasBalancedBrackets(text);

const isBracket = (char: string) => char === "(" || char === ")";

// The parts a background already holds: each pair's content, nested ones too, and the bare text between pairs, in
// order. Unbalanced text, or text with no pair, is one part as it is.
function backgroundParts(text: string): string[] {
  if (!hasBalancedPairs(text)) return text ? [text] : [];
  const parts: string[] = [];
  let current = "";
  for (const char of text) {
    if (!isBracket(char)) {
      current += char;
      continue;
    }
    if (current.trim()) parts.push(current.trim());
    current = "";
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// The word-level twin of `backgroundParts`: every bracket comes off, and each part but the last ends in the mark.
function wordsAsParts(words: readonly WordTiming[], separator: BackgroundSeparator): WordTiming[] {
  if (!hasBalancedPairs(words.map((word) => word.text + word.sep).join(""))) return [...words];
  return words.map((word, index) => {
    const text = [...word.text].filter((char) => !isBracket(char)).join("");
    const next = words[index + 1];
    const endsPart = next !== undefined && text !== "" && (word.text.includes(")") || next.text.startsWith("("));
    return { ...word, text: endsPart ? withMark(text, separator) : text };
  });
}

// A background holding pairs that extraction writes differently: as one pair, or without brackets when none are kept.
function needsOnePair(text: string, join: BracketJoin): boolean {
  const trimmed = text.trim();
  if (!hasBalancedPairs(trimmed) || backgroundParts(trimmed).length === 0) return false;
  return onePairText(trimmed, join) !== trimmed;
}

function onePairText(text: string, join: BracketJoin): string {
  return wrappedPair(joinExtractedParts(backgroundParts(text.trim()), join.separator), join);
}

const wrappedPair = (joined: string, join: BracketJoin) => (join.preserveBrackets ? `(${joined})` : joined);

// -- Joins --------------------------------------------------------------------

// A line's background is one pair: the parts it held, then each addition after the separator.
function joinBackgroundText(existing: string | undefined, addition: string, join: BracketJoin): string {
  return wrappedPair(joinExtractedParts([...backgroundParts(existing?.trim() ?? ""), addition], join.separator), join);
}

// The word-level twin of `joinBackgroundText`, so timed words spell the same text.
function joinBracketedCarriedWords(baseWords: WordTiming[], carried: WordTiming[], join: BracketJoin): WordTiming[] {
  const base = wordsAsParts(baseWords, join.separator);
  const added = wordsAsParts(carried, join.separator);
  const last = base.at(-1);
  if (last && added.length > 0) {
    const lastSpaced = last.text + last.sep;
    const text = `${withMark(stripTrailingSpace(lastSpaced), join.separator)}${trailingSpaceOf(lastSpaced) || " "}`;
    base[base.length - 1] = wordFromSpaced({ ...last, text, joinsNext: false });
  }
  const combined = [...base, ...added];
  return join.preserveBrackets ? bracketWordList(combined) : combined;
}

// Timed words that open a one-pair background whose untimed rest follows in the text, where the pair closes.
function withOpenPair(words: WordTiming[], join: BracketJoin, restStartsPart: boolean): WordTiming[] {
  const last = words.at(-1);
  if (!last) return words;
  const spaced = stripTrailingSpace(last.text + last.sep);
  const open = join.preserveBrackets && spaced.endsWith(")") ? spaced.slice(0, -1) : spaced;
  const ended = restStartsPart ? withMark(open, join.separator) : open;
  return words.with(-1, wordFromSpaced({ ...last, text: `${ended} `, joinsNext: false }));
}

// Timed words that open the one pair an untimed addition follows: their own pairs come off, the last ends in the mark.
function wordsOpeningPair(words: readonly WordTiming[], join: BracketJoin): WordTiming[] {
  const parts = wordsAsParts(words, join.separator);
  const last = parts.at(-1);
  if (!last) return parts;
  const ended = withMark(stripTrailingSpace(last.text + last.sep), join.separator);
  parts[parts.length - 1] = wordFromSpaced({ ...last, text: `${ended} `, joinsNext: false });
  if (join.preserveBrackets) parts[0] = { ...parts[0], text: `(${parts[0].text}` };
  return parts;
}

// -- Exports ------------------------------------------------------------------

export type { BackgroundSeparator, BracketJoin };
export {
  bracketWordList,
  hasBalancedBrackets,
  joinBackgroundText,
  joinBracketedCarriedWords,
  joinExtractedParts,
  needsOnePair,
  onePairText,
  withOpenPair,
  wordsOpeningPair,
  backgroundParts,
};
