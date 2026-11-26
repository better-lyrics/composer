import { wordFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { withTrailingSpace } from "@/utils/word-spaces";

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

// -- Seam-aware concatenation -------------------------------------------------

function joinBracketedCarriedWords(
  baseWords: WordTiming[],
  carried: WordTiming[],
  canSeamStrip: boolean,
): WordTiming[] {
  if (!canSeamStrip) return [...withTrailingSpace(baseWords), ...carried];
  if (baseWords.length === 0) return carried;
  if (carried.length === 0) return baseWords;
  const lastBase = baseWords[baseWords.length - 1];
  const firstCarry = carried[0];
  const lastBaseSpaced = lastBase.text + lastBase.sep;
  const lastBaseStripped = stripTrailingSpace(lastBaseSpaced);
  const lastBaseTrail = trailingSpaceOf(lastBaseSpaced);
  const lastEndsBracket = lastBaseStripped.endsWith(")");
  const firstStartsBracket = firstCarry.text.startsWith("(");
  if (!lastEndsBracket || !firstStartsBracket) return [...withTrailingSpace(baseWords), ...carried];
  const lastBaseText = `${lastBaseStripped.slice(0, -1)}${lastBaseTrail.length > 0 ? lastBaseTrail : " "}`;
  const firstCarryText = firstCarry.text.slice(1);
  return [
    ...baseWords.slice(0, -1),
    wordFromSpaced({ ...lastBase, text: lastBaseText }),
    { ...firstCarry, text: firstCarryText },
    ...carried.slice(1),
  ];
}

function joinBackgroundText(
  existing: string | undefined,
  addition: string,
  preserveBrackets: boolean,
  trailingBracketFromSamePass: boolean,
): string {
  const base = existing?.trim() ?? "";
  if (!preserveBrackets) return base.length > 0 ? `${base} ${addition}` : addition;
  if (base.length === 0) return `(${addition})`;
  if (trailingBracketFromSamePass && base.endsWith(")")) return `${base.slice(0, -1)} ${addition})`;
  return `${base} (${addition})`;
}

// -- Exports ------------------------------------------------------------------

export { bracketWordList, joinBackgroundText, joinBracketedCarriedWords };
