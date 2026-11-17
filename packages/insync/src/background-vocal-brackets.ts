import { wordFromSpaced } from "./word-spaced-words";
import type { WordTiming } from "./word-timing";
import { withTrailingSpace } from "./word-spaces";

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

// -- Seam-aware concatenation -------------------------------------------------

// Carried words extending a pair follow its last word after the separator, inside the pair when both sides have one.
function joinBracketedCarriedWords(
  baseWords: WordTiming[],
  carried: WordTiming[],
  join: BracketJoin,
  extendsPair: boolean,
): WordTiming[] {
  if (!extendsPair) return [...withTrailingSpace(baseWords), ...carried];
  if (baseWords.length === 0) return carried;
  if (carried.length === 0) return baseWords;
  const lastBase = baseWords[baseWords.length - 1];
  const firstCarry = carried[0];
  const lastBaseSpaced = lastBase.text + lastBase.sep;
  const lastBaseStripped = stripTrailingSpace(lastBaseSpaced);
  const lastBaseTrail = trailingSpaceOf(lastBaseSpaced) || " ";
  const mark = SEPARATOR_MARK[join.separator];
  const stripsSeam = join.preserveBrackets && lastBaseStripped.endsWith(")") && firstCarry.text.startsWith("(");
  const lastBaseText = stripsSeam
    ? `${lastBaseStripped.slice(0, -1)}${mark}${lastBaseTrail}`
    : `${lastBaseStripped}${mark}${lastBaseTrail}`;
  return [
    ...baseWords.slice(0, -1),
    wordFromSpaced({ ...lastBase, text: lastBaseText, joinsNext: false }),
    stripsSeam ? { ...firstCarry, text: firstCarry.text.slice(1) } : firstCarry,
    ...carried.slice(1),
  ];
}

// Extracted text joins the pair it extends; a background typed by hand keeps its own and the addition follows it.
function joinBackgroundText(
  existing: string | undefined,
  addition: string,
  join: BracketJoin,
  extendsPair: boolean,
): string {
  const base = existing?.trim() ?? "";
  const wrapped = join.preserveBrackets ? `(${addition})` : addition;
  if (base.length === 0) return wrapped;
  if (!extendsPair) return `${base} ${wrapped}`;
  const separator = separatorText(join.separator);
  if (join.preserveBrackets && base.endsWith(")")) return `${base.slice(0, -1)}${separator}${addition})`;
  return `${base}${separator}${wrapped}`;
}

// -- Exports ------------------------------------------------------------------

export type { BackgroundSeparator, BracketJoin };
export { bracketWordList, joinBackgroundText, joinBracketedCarriedWords, joinExtractedParts };
