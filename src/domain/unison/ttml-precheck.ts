import { hasLetterOrDigit } from "@/domain/alignment/cjk";
import { parseTtmlTimestamp } from "@/utils/lyrics-parsers/ttml-helpers";
import { parseXmlDocument } from "@/utils/xml-document";

// Mirrors Unison's submit checks (`detectPrettyPrintedTtml` and
// `hasDegenerateWordTiming` in unison/src/utils/validation.ts).

// -- Types ---------------------------------------------------------------------

type UnisonTtmlProblem = "line-breaks" | "padded-words" | "zero-length-words";

type UnisonTtmlPrecheck = { ok: true } | { ok: false; problem: UnisonTtmlProblem };

// -- Constants -----------------------------------------------------------------

const LINE_BREAK_BETWEEN_SPANS = /<\/span>\s*[\r\n]\s*<span\b/i;
const TRAILING_SPACE_IN_SPAN = /<span\b[^>]*>[^<]*?\S[ \t]+<\/span>\s*<span\b/i;
const LEADING_SPACE_IN_SPAN = /<\/span>\s*<span\b[^>]*>[ \t]+\S[^<]*<\/span>/i;
const MAX_ZERO_LENGTH_RATIO = 0.2;

// -- Functions -----------------------------------------------------------------

function directText(element: Element): string {
  return [...element.childNodes]
    .filter((node) => node.nodeType === node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join("");
}

function hasMostlyZeroLengthWords(content: string): boolean {
  const parsed = parseXmlDocument(content);
  if (!parsed.ok) return false;
  let timedWords = 0;
  let zeroLengthWords = 0;
  for (const span of parsed.doc.querySelectorAll("p span")) {
    const begin = span.getAttribute("begin");
    const end = span.getAttribute("end");
    if (begin === null || end === null || !hasLetterOrDigit(directText(span))) continue;
    const beginSeconds = parseTtmlTimestamp(begin);
    const endSeconds = parseTtmlTimestamp(end);
    if (!Number.isFinite(beginSeconds) || !Number.isFinite(endSeconds)) continue;
    timedWords++;
    if (endSeconds <= beginSeconds) zeroLengthWords++;
  }
  return timedWords > 0 && zeroLengthWords / timedWords > MAX_ZERO_LENGTH_RATIO;
}

function precheckUnisonTtml(content: string): UnisonTtmlPrecheck {
  if (LINE_BREAK_BETWEEN_SPANS.test(content)) return { ok: false, problem: "line-breaks" };
  if (TRAILING_SPACE_IN_SPAN.test(content) || LEADING_SPACE_IN_SPAN.test(content)) {
    return { ok: false, problem: "padded-words" };
  }
  if (hasMostlyZeroLengthWords(content)) return { ok: false, problem: "zero-length-words" };
  return { ok: true };
}

// -- Exports -------------------------------------------------------------------

export type { UnisonTtmlPrecheck, UnisonTtmlProblem };
export { precheckUnisonTtml };
