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

// -- One pair -----------------------------------------------------------------

// Whether the "(" opening the text is closed by its last character, so the whole text is one pair.
function isOnePair(text: string): boolean {
  if (!text.startsWith("(")) return false;
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "(") depth++;
    else if (text[index] === ")" && --depth === 0) return index === text.length - 1;
  }
  return false;
}

function withoutOuterPair(text: string): string {
  return isOnePair(text) ? text.slice(1, -1).trim() : text;
}

function wordsWithoutOuterPair(words: WordTiming[]): WordTiming[] {
  if (!isOnePair(stripTrailingSpace(words.map((word) => word.text + word.sep).join("")))) return words;
  const out = [...words];
  out[0] = { ...out[0], text: out[0].text.slice(1) };
  const last = out[out.length - 1];
  const lastSpaced = last.text + last.sep;
  out[out.length - 1] = wordFromSpaced({
    ...last,
    text: `${stripTrailingSpace(lastSpaced).slice(0, -1)}${trailingSpaceOf(lastSpaced)}`,
  });
  return out;
}

// -- Joins --------------------------------------------------------------------

// A line's background is one pair: what it held, then each addition after the separator.
function joinBackgroundText(existing: string | undefined, addition: string, join: BracketJoin): string {
  const base = withoutOuterPair(existing?.trim() ?? "");
  const joined = base ? `${base}${separatorText(join.separator)}${addition}` : addition;
  return join.preserveBrackets ? `(${joined})` : joined;
}

// The word-level twin of `joinBackgroundText`, so timed words spell the same text.
function joinBracketedCarriedWords(baseWords: WordTiming[], carried: WordTiming[], join: BracketJoin): WordTiming[] {
  const base = [...wordsWithoutOuterPair(baseWords)];
  const added = wordsWithoutOuterPair(carried);
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
  withoutOuterPair,
};
