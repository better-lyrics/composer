import type { XmlReadElement, XmlReadNode } from "./xml-read-tree";
import type { Passthrough } from "../passthrough";
import type { XmlChild } from "../xml-node";
import type { LineTrack, LyricLine, Syllable } from "../line";
import { syllableJoint, syllablesText } from "../line-text";
import { backgroundTrack, mainTrack } from "../line-track";
import { withBackgroundTrack, withMainTrack } from "../line-track-writes";
import type { WordTiming } from "../word-timing";
import { elementRole, isLyricTextElement, isTimedWordSpan, LYRIC_ROLES } from "./modelled";
import { mixedContentPassthrough } from "./passthrough-read";
import { parseTtmlTimestamp } from "./timestamp";
import { markupBaseText } from "./markup";

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
  // Where each piece of lyric text read from the source ends in `text`.
  readonly ends: ReadonlyMap<XmlReadNode, number>;
}

// -- Reading ------------------------------------------------------------------

// The lyric text of a line or background with no timed syllables, trimmed, and the spans in it that kept data;
// background, translation and romanization spans are not lyric text.
function untimedLyric(container: XmlReadElement): UntimedLyric {
  let text = "";
  const spans: KeptSpan[] = [];
  const ends = new Map<XmlReadNode, number>();
  for (const node of container.childNodes) {
    if (node.kind === "text") {
      text += node.text;
      ends.set(node, text.length);
    }
    if (node.kind !== "element") continue;
    const element = node;
    if (LYRIC_ROLES.has(elementRole(element) ?? "") || !isLyricTextElement(element)) continue;
    const kept = mixedContentPassthrough("syllable", element);
    const piece = kept?.markup ? markupBaseText(kept.markup) : element.textContent;
    if (kept) spans.push({ start: text.length, end: text.length + piece.length, passthrough: kept });
    text += piece;
    ends.set(element, text.length);
  }
  return trimmedLyric(text, spans, ends);
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
  return trimmedLyric(text, spans, new Map());
}

function trimmedLyric(text: string, spans: readonly KeptSpan[], ends: ReadonlyMap<XmlReadNode, number>): UntimedLyric {
  const lead = text.length - text.trimStart().length;
  return {
    text: text.trim(),
    spans: spans.map((span) => ({ ...span, start: span.start - lead, end: span.end - lead })),
    ends: new Map([...ends].map(([node, end]) => [node, end - lead])),
  };
}

// -- Untimed rest -------------------------------------------------------------

// The text after a container's last timed span, as written: the untimed rest of a partly synced track.
function untimedTail(container: XmlReadElement): string {
  const nodes = container.childNodes;
  const last = nodes.findLastIndex((node) => node.kind === "element" && isTimedWordSpan(node));
  let tail = "";
  for (const node of nodes.slice(last + 1)) if (node.kind === "text") tail += node.text;
  return tail;
}

// A word-synced track's words and text, the text running on through the untimed rest after the last span; a rest
// written straight after that span joins its word.
function timedTrackText(
  words: WordTiming[],
  container: XmlReadElement,
  splitChar: string,
): { text: string; words: WordTiming[] } {
  const tail = untimedTail(container);
  const closing = words.at(-1);
  if (!closing || tail.trim() === "") return { text: syllablesText(words, splitChar), words };
  const read = /^\s/.test(tail) || closing.sep === "" ? words : words.with(-1, { ...closing, sep: "" });
  return { text: syllablesText(read, splitChar) + tail.trim(), words: read };
}

// An untimed background's own span when its container wrote one, each missing bound taken from the `<p>`; one that
// wrote none takes the time of a line-synced `<p>`, as TTML times it.
function untimedBackgroundSpan(bg: XmlReadElement, begin: number, end: number, lineSynced: boolean) {
  if (!bg.hasAttribute("begin") && !bg.hasAttribute("end")) {
    return lineSynced && Number.isFinite(begin) && Number.isFinite(end) && begin <= end
      ? { backgroundBegin: begin, backgroundEnd: end }
      : {};
  }
  const ownBegin = bg.hasAttribute("begin") ? parseTtmlTimestamp(bg.getAttribute("begin") ?? "") : begin;
  const ownEnd = bg.hasAttribute("end") ? parseTtmlTimestamp(bg.getAttribute("end") ?? "") : end;
  if (!Number.isFinite(ownBegin) || !Number.isFinite(ownEnd) || ownEnd < ownBegin) return {};
  return { backgroundBegin: ownBegin, backgroundEnd: ownEnd };
}

// -- Syllables ----------------------------------------------------------------

// Where each syllable sits in the text the syllables spell.
function syllableRanges(syllables: readonly Syllable[], splitChar: string): { start: number; end: number }[] {
  let at = 0;
  return syllables.map((syllable, index) => {
    const start = at;
    const end = start + syllable.text.length;
    at = end + syllableJoint(syllables, index, splitChar).length;
    return { start, end };
  });
}

// Every syllable a kept span wrote whole takes its data; a track whose syllables do not spell the text takes none.
function withSpans<T extends LineTrack>(track: T, lyric: UntimedLyric | undefined, splitChar: string): T {
  if (!lyric || lyric.spans.length === 0) return track;
  if (syllablesText(track.syllables, splitChar) !== lyric.text) return track;
  const ranges = syllableRanges(track.syllables, splitChar);
  let spanIndex = 0;
  const syllables = track.syllables.map((syllable, index) => {
    const { start, end } = ranges[index];
    while (spanIndex < lyric.spans.length && lyric.spans[spanIndex].end < end) spanIndex++;
    const span = lyric.spans[spanIndex];
    return span && span.start <= start && end <= span.end ? { ...syllable, passthrough: span.passthrough } : syllable;
  });
  return { ...track, syllables };
}

function withUntimedSpans(
  line: LyricLine,
  main: UntimedLyric | undefined,
  background: UntimedLyric | undefined,
  splitChar: string,
) {
  const bg = backgroundTrack(line);
  const withMain = withMainTrack(line, withSpans(mainTrack(line), main, splitChar));
  return bg ? withBackgroundTrack(withMain, withSpans(bg, background, splitChar)) : withMain;
}

// A line-synced background's syllables take back the kept spans its one timed span was written with.
function withSpansFromMarkup<T extends LineTrack>(track: T, markup: readonly XmlChild[], splitChar: string): T {
  return withSpans(track, untimedLyricOfMarkup(markup), splitChar);
}

// -- Anchors ------------------------------------------------------------------

// The syllable each piece of lyric text reaches into, which kept elements after that piece follow; none when the
// syllables do not spell the text.
function untimedAnchors(
  lyric: UntimedLyric | undefined,
  track: LineTrack | undefined,
  splitChar: string,
): ReadonlyMap<XmlReadNode, string> {
  if (!lyric || !track || syllablesText(track.syllables, splitChar) !== lyric.text) return new Map();
  const ranges = syllableRanges(track.syllables, splitChar);
  const anchors = new Map<XmlReadNode, string>();
  for (const [node, end] of lyric.ends) {
    const reached = ranges.findLastIndex((range) => range.start < end);
    if (reached >= 0) anchors.set(node, track.syllables[reached].id);
  }
  return anchors;
}

// -- Exports ------------------------------------------------------------------

export type { UntimedLyric };
export { timedTrackText, untimedAnchors, untimedBackgroundSpan, untimedLyric, withSpansFromMarkup, withUntimedSpans };
