import type { XmlReadElement, XmlReadNode } from "./xml-read-tree";
import type { Passthrough } from "../passthrough";
import type { XmlChild } from "../xml-node";
import type { LineTrack, LyricLine, Syllable } from "../line";
import type { LineFields } from "../line-from-fields";
import { splitIntoWordsWithMeta } from "../lyric-words";
import { syllableJoint, syllablesText } from "../line-text";
import { backgroundTrack, mainTrack, timedSyllables } from "../line-track";
import { withBackgroundTrack, withMainTrack } from "../line-track-writes";
import type { WordTiming } from "../word-timing";
import { elementRole, isLyricTextElement, LYRIC_ROLES, untimedRestNodes } from "./modelled";
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

type BackgroundSpan = Pick<LineFields, "backgroundBegin" | "backgroundEnd" | "backgroundExplicit">;

interface UntimedLyric {
  readonly text: string;
  readonly spans: readonly KeptSpan[];
  // Where each piece of lyric text read from the source ends in `text`.
  readonly ends: ReadonlyMap<XmlReadNode, number>;
}

// -- Reading ------------------------------------------------------------------

// Lyric text read from a run of nodes, untrimmed, and the spans in it that kept data; background, translation and
// romanization spans are not lyric text.
function lyricOfNodes(nodes: readonly XmlReadNode[]): UntimedLyric {
  let text = "";
  const spans: KeptSpan[] = [];
  const ends = new Map<XmlReadNode, number>();
  for (const node of nodes) {
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
  return { text, spans, ends };
}

// The lyric text of a line or background with no timed syllables, trimmed, and the spans in it that kept data.
function untimedLyric(container: XmlReadElement): UntimedLyric {
  const { text, spans, ends } = lyricOfNodes(container.childNodes);
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

// A line-synced background's one timed span read as its kept spans; content other than text and spans, or attributes
// beside markup, is read as one kept span around all of it, so nothing it held is dropped.
function untimedLyricOfTimedSpan(text: string, kept: Passthrough | undefined): UntimedLyric {
  const { markup, attrs = [] } = kept ?? {};
  const readsAsSpans = (content: readonly XmlChild[]) =>
    attrs.length === 0 && content.every((child) => "text" in child || child.name.toLowerCase() === "span");
  if (markup && readsAsSpans(markup)) return untimedLyricOfMarkup(markup);
  return untimedLyricOfMarkup([{ name: "span", attrs, children: markup ?? [{ text }] }]);
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

// A word-synced track's words and text, the text running on through the untimed rest after the last span, and that
// rest as read; a rest written straight after that span joins its word.
function timedTrackText(
  words: WordTiming[],
  container: XmlReadElement,
  splitChar: string,
): { text: string; words: WordTiming[]; rest: UntimedLyric } {
  const tail = lyricOfNodes(untimedRestNodes(container));
  const rest = trimmedLyric(tail.text, tail.spans, tail.ends);
  const closing = words.at(-1);
  if (!closing || rest.text === "") return { text: syllablesText(words, splitChar), words, rest };
  const read = /^\s/.test(tail.text) || closing.sep === "" ? words : words.with(-1, { ...closing, sep: "" });
  return { text: syllablesText(read, splitChar) + rest.text, words: read, rest };
}

// A background written as one timed span of more than one word is line synced, its syllables read from its text as a
// line-synced `<p>`'s are. One word stays a timed word.
function lineSyncedBackground(
  container: XmlReadElement,
  timed: { words: readonly WordTiming[]; rest: UntimedLyric },
  splitChar: string,
): { lyric: UntimedLyric; span: BackgroundSpan } | null {
  const [span, ...others] = timed.words;
  if (!span || others.length > 0 || timed.rest.text !== "" || container.children.length !== 1) return null;
  const { trailingSpace } = splitIntoWordsWithMeta(span.text, splitChar);
  if (!trailingSpace.slice(0, -1).some(Boolean)) return null;
  return {
    lyric: untimedLyricOfTimedSpan(span.text, span.passthrough),
    span: { backgroundBegin: span.begin, backgroundEnd: span.end, ...(span.explicit && { backgroundExplicit: true }) },
  };
}

// An untimed background's own span when its container wrote one, each missing bound taken from the `<p>`; one that
// wrote none takes the time of a line-synced `<p>`, as TTML times it.
function untimedBackgroundSpan(bg: XmlReadElement, begin: number, end: number, lineSynced: boolean): BackgroundSpan {
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

// Every untimed syllable a kept span wrote whole takes its data; untimed syllables that do not spell the text take none.
function withSpans<T extends LineTrack>(track: T, lyric: UntimedLyric | undefined, splitChar: string): T {
  if (!lyric || lyric.spans.length === 0) return track;
  const timed = timedSyllables(track);
  const rest = track.syllables.slice(timed.length);
  if (syllablesText(rest, splitChar) !== lyric.text) return track;
  const ranges = syllableRanges(rest, splitChar);
  let spanIndex = 0;
  const kept = rest.map((syllable, index) => {
    const { start, end } = ranges[index];
    while (spanIndex < lyric.spans.length && lyric.spans[spanIndex].end < end) spanIndex++;
    const span = lyric.spans[spanIndex];
    return span && span.start <= start && end <= span.end ? { ...syllable, passthrough: span.passthrough } : syllable;
  });
  return { ...track, syllables: [...timed, ...kept] };
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
function withSpansOfTimedSpan<T extends LineTrack>(
  track: T,
  span: Pick<WordTiming, "text" | "passthrough">,
  splitChar: string,
): T {
  return withSpans(track, untimedLyricOfTimedSpan(span.text, span.passthrough), splitChar);
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

export type { BackgroundSpan, UntimedLyric };
export {
  lineSyncedBackground,
  timedTrackText,
  untimedAnchors,
  untimedBackgroundSpan,
  untimedLyric,
  withSpansOfTimedSpan,
  withUntimedSpans,
};
