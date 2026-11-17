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

const separatorText = (separator: BackgroundSeparator) => `${SEPARATOR_MARK[separator]} `;

function joinExtractedParts(parts: readonly string[], separator: BackgroundSeparator): string {
  return parts.join(separatorText(separator));
}

// -- Parts --------------------------------------------------------------------

function hasBalancedPairs(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === "(") depth++;
    else if (char === ")" && --depth < 0) return false;
  }
  return depth === 0 && text.includes("(");
}

// The parts a background already holds: each top-level pair's content and the bare text between pairs, in order.
// Unbalanced text, or text with no pair, is one part as it is.
function backgroundParts(text: string): string[] {
  if (!hasBalancedPairs(text)) return text ? [text] : [];
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  const close = () => {
    if (current.trim()) parts.push(current.trim());
    current = "";
  };
  for (const char of text) {
    if (char === "(" && depth++ === 0) close();
    else if (char === ")" && --depth === 0) close();
    else current += char;
  }
  close();
  return parts;
}

// The word-level twin of `backgroundParts`: top-level brackets come off, and each part but the last ends in the mark.
function wordsAsParts(words: readonly WordTiming[], separator: BackgroundSeparator): WordTiming[] {
  if (!hasBalancedPairs(words.map((word) => word.text + word.sep).join(""))) return [...words];
  let depth = 0;
  const read = words.map((word) => {
    let text = "";
    let closesPart = false;
    for (const char of word.text) {
      if (char === "(" && depth++ === 0) continue;
      if (char === ")" && --depth === 0) {
        closesPart = true;
        continue;
      }
      text += char;
    }
    return { word, text, closesPart, bareAtEnd: depth === 0 };
  });
  return read.map(({ word, text, closesPart, bareAtEnd }, index) => {
    const next = words[index + 1];
    const endsPart = next !== undefined && (closesPart || (bareAtEnd && next.text.startsWith("(")));
    return { ...word, text: endsPart ? `${text}${SEPARATOR_MARK[separator]}` : text };
  });
}

// -- Joins --------------------------------------------------------------------

// A line's background is one pair: the parts it held, then each addition after the separator.
function joinBackgroundText(existing: string | undefined, addition: string, join: BracketJoin): string {
  const joined = joinExtractedParts([...backgroundParts(existing?.trim() ?? ""), addition], join.separator);
  return join.preserveBrackets ? `(${joined})` : joined;
}

// The word-level twin of `joinBackgroundText`, so timed words spell the same text.
function joinBracketedCarriedWords(baseWords: WordTiming[], carried: WordTiming[], join: BracketJoin): WordTiming[] {
  const base = wordsAsParts(baseWords, join.separator);
  const added = wordsAsParts(carried, join.separator);
  const last = base.at(-1);
  if (last && added.length > 0) {
    const lastSpaced = last.text + last.sep;
    const text = `${stripTrailingSpace(lastSpaced)}${SEPARATOR_MARK[join.separator]}${trailingSpaceOf(lastSpaced) || " "}`;
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
  const mark = restStartsPart ? SEPARATOR_MARK[join.separator] : "";
  return words.with(-1, wordFromSpaced({ ...last, text: `${open}${mark} `, joinsNext: false }));
}

// -- Exports ------------------------------------------------------------------

export type { BackgroundSeparator, BracketJoin };
export {
  bracketWordList,
  joinBackgroundText,
  joinBracketedCarriedWords,
  joinExtractedParts,
  withOpenPair,
  backgroundParts,
};
