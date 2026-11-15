import type { Passthrough } from "insync/passthrough";
import type { XmlChild } from "insync/xml-node";
import type { LineTrack, LyricLine } from "insync/line";
import { syllableJoint, syllablesText } from "@/domain/line/text";
import { backgroundTrack, mainTrack } from "insync/line-track";
import { withBackgroundTrack, withMainTrack } from "@/domain/line/track-writes";
import { elementRole, isLyricTextElement, LYRIC_ROLES } from "@/utils/lyrics-parsers/ttml-modelled";
import { mixedContentPassthrough } from "@/utils/lyrics-parsers/ttml-passthrough-read";
import { getSplitCharacter } from "@/utils/split-character";
import { markupBaseText } from "@/utils/ttml-markup";

// -- Types --------------------------------------------------------------------

// A span's place in the lyric text, by character offsets, and what it carried.
interface KeptSpan {
  readonly start: number;
  readonly end: number;
  readonly passthrough: Passthrough;
}

interface UntimedLyric {
  readonly text: string;
  readonly spans: readonly KeptSpan[];
}

// -- Reading ------------------------------------------------------------------

// The lyric text of a line or background with no timed syllables, trimmed, and the spans in it that kept data;
// background, translation and romanization spans are not lyric text.
function untimedLyric(container: Element): UntimedLyric {
  let text = "";
  const spans: KeptSpan[] = [];
  for (const node of container.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const element = node as Element;
    if (LYRIC_ROLES.has(elementRole(element) ?? "") || !isLyricTextElement(element)) continue;
    const kept = mixedContentPassthrough("syllable", element);
    const piece = kept?.markup ? markupBaseText(kept.markup) : (element.textContent ?? "");
    if (kept) spans.push({ start: text.length, end: text.length + piece.length, passthrough: kept });
    text += piece;
  }
  return trimmedLyric(text, spans);
}

// The same reading over kept markup: what the writer put inside a line-synced background's one timed span.
function untimedLyricOfMarkup(markup: readonly XmlChild[]): UntimedLyric {
  let text = "";
  const spans: KeptSpan[] = [];
  for (const child of markup) {
    if ("text" in child) text += child.text;
    else if (child.name.toLowerCase() === "span") {
      const inner = child.children.some((node) => !("text" in node)) ? child.children : undefined;
      const piece = markupBaseText(child.children);
      if (child.attrs.length > 0 || inner) {
        const passthrough = { ...(child.attrs.length > 0 && { attrs: child.attrs }), ...(inner && { markup: inner }) };
        spans.push({ start: text.length, end: text.length + piece.length, passthrough });
      }
      text += piece;
    }
  }
  return trimmedLyric(text, spans);
}

function trimmedLyric(text: string, spans: readonly KeptSpan[]): UntimedLyric {
  const lead = text.length - text.trimStart().length;
  return {
    text: text.trim(),
    spans: spans.map((span) => ({ ...span, start: span.start - lead, end: span.end - lead })),
  };
}

// -- Syllables ----------------------------------------------------------------

// Every syllable a kept span wrote whole takes its data; a track whose syllables do not spell the text takes none.
function withSpans<T extends LineTrack>(track: T, lyric: UntimedLyric | undefined): T {
  if (!lyric || lyric.spans.length === 0) return track;
  const splitChar = getSplitCharacter();
  if (syllablesText(track.syllables, splitChar) !== lyric.text) return track;
  let at = 0;
  let spanIndex = 0;
  const syllables = track.syllables.map((syllable, index) => {
    const start = at;
    const end = start + syllable.text.length;
    at = end + syllableJoint(track.syllables, index, splitChar).length;
    while (spanIndex < lyric.spans.length && lyric.spans[spanIndex].end < end) spanIndex++;
    const span = lyric.spans[spanIndex];
    return span && span.start <= start && end <= span.end ? { ...syllable, passthrough: span.passthrough } : syllable;
  });
  return { ...track, syllables };
}

function withUntimedSpans(line: LyricLine, main: UntimedLyric | undefined, background: UntimedLyric | undefined) {
  const bg = backgroundTrack(line);
  const withMain = withMainTrack(line, withSpans(mainTrack(line), main));
  return bg ? withBackgroundTrack(withMain, withSpans(bg, background)) : withMain;
}

// A line-synced background's syllables take back the kept spans its one timed span was written with.
function withSpansFromMarkup<T extends LineTrack>(track: T, markup: readonly XmlChild[]): T {
  return withSpans(track, untimedLyricOfMarkup(markup));
}

// -- Exports ------------------------------------------------------------------

export type { UntimedLyric };
export { untimedLyric, withSpansFromMarkup, withUntimedSpans };
