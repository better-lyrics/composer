import type { Part, PartSection } from "../part";
import type { DocPassthrough } from "../passthrough";
import { escapeXmlAttribute } from "../xml-node";
import { bgBounds, effectiveBounds } from "../line-bounds";
import { drawnSyllables } from "../line-drawn-track";
import type { LineTrack, LyricLine } from "../line";
import { isWordSynced } from "../line-predicates";
import { backgroundText, lineText } from "../line-text";
import { backgroundTrack, mainTrack, timedSyllables } from "../line-track";
import type { WordTiming } from "../word-timing";
import { formatTime } from "../format-time";
import { BACKGROUND_ANCHOR, TEXT_ANCHOR } from "./anchors";
import type { Indent } from "./head";
import { backgroundEnvelope, lineEnvelope, partEnvelope, writtenTimes } from "./kept-times";
import { isExportedLine } from "./line-keys";
import { emitWordSpan, spanEndsInSpace } from "./markup";
import {
  anchorResolver,
  keptAmongInline,
  keptAmongLines,
  keptAttributes,
  keptTimesAttributes,
  type Placed,
} from "./passthrough-write";
import { untimedTrackPieces, untimedTrackSpan } from "./untimed-write";

// -- Types --------------------------------------------------------------------

interface BodySource {
  lines: readonly LyricLine[];
  keyById: ReadonlyMap<string, string>;
  writesWords: boolean;
  duration?: number;
  parts?: readonly Part[];
  passthrough?: DocPassthrough;
}

interface Writer {
  source: BodySource;
  ind: Indent;
  written: Set<PartSection>;
  lineOrder: readonly string[];
}

interface Run<T> {
  section?: T;
  lines: LyricLine[];
}

// -- Paragraphs ---------------------------------------------------------------

function spanPieces(words: readonly WordTiming[]): Placed<string>[] {
  return words.map((word, i) => {
    const needsSpace = i < words.length - 1 && word.sep.endsWith(" ") && !spanEndsInSpace(word.text, word.passthrough);
    return { out: `${emitWordSpan(word, word.text, word.passthrough)}${needsSpace ? " " : ""}`, anchors: [word.id] };
  });
}

// A track written whole stands for its text and every syllable in it.
const wholeTrack = (out: string, track: LineTrack): Placed<string> => ({
  out,
  anchors: [TEXT_ANCHOR, ...track.syllables.map((syllable) => syllable.id)],
});

const trackOrder = (track: LineTrack) => [...track.syllables.map((syllable) => syllable.id), TEXT_ANCHOR];

function backgroundSpan(line: LyricLine, writesWords: boolean, splitChar: string): string {
  const bgText = backgroundText(line, splitChar);
  const background = backgroundTrack(line);
  if (!bgText || !background) return "";
  const bgWords = timedSyllables(background);
  const kept = background.passthrough;
  const open = `<span ttm:role="x-bg"${keptTimesAttributes(kept?.times, () => backgroundEnvelope(line))}${keptAttributes(kept)}>`;
  const order = trackOrder(background);
  if (writesWords && bgWords.length) return `${open}${keptAmongInline(spanPieces(bgWords), kept, order)}</span>`;
  const bgTiming = bgBounds(line) ?? effectiveBounds(line);
  if (!bgTiming) return "";
  const explicit = drawnSyllables(line, "bg", splitChar)[0]?.explicit;
  const whole = untimedTrackSpan({ ...bgTiming, explicit }, background, bgText, splitChar);
  return `${open}${keptAmongInline([wholeTrack(whole, background)], kept, order)}</span>`;
}

function paragraph(line: LyricLine, source: BodySource, indent: string, splitChar: string): string {
  const envelope = lineEnvelope(line) ?? ["", ""];
  const [keptBegin, keptEnd] = line.passthrough?.times ? writtenTimes(line.passthrough.times, envelope) : [];
  const [begin, end] = [keptBegin ?? envelope[0], keptEnd ?? envelope[1]];
  const main = mainTrack(line);
  const agentAttr = main.agentId ? ` ttm:agent="${escapeXmlAttribute(main.agentId)}"` : "";
  const lineKey = source.keyById.get(line.id);
  const keyAttr = lineKey ? ` itunes:key="${lineKey}"` : "";
  const groupAttr = line.groupId
    ? ` composer:groupId="${escapeXmlAttribute(line.groupId)}" composer:instanceIdx="${line.instanceIdx ?? 0}" composer:templateLineIdx="${line.templateLineIdx ?? 0}"${line.detached ? ' composer:detached="true"' : ""}`
    : "";
  const content =
    source.writesWords && isWordSynced(line)
      ? spanPieces(timedSyllables(main))
      : untimedTrackPieces(main, lineText(line, splitChar), splitChar).map((piece, index, pieces) =>
          index === pieces.length - 1 ? { ...piece, anchors: [...piece.anchors, TEXT_ANCHOR] } : piece,
        );
  const background = backgroundSpan(line, source.writesWords, splitChar);
  const units = background ? [...content, { out: background, anchors: [BACKGROUND_ANCHOR] }] : content;
  const written = keptAmongInline(units, line.passthrough, [...trackOrder(main), BACKGROUND_ANCHOR]);
  return `${indent}<p begin="${escapeXmlAttribute(begin)}" end="${escapeXmlAttribute(end)}"${keyAttr}${agentAttr}${groupAttr}${keptAttributes(line.passthrough)}>${written}</p>`;
}

// -- Sections -----------------------------------------------------------------

// Runs of written lines in the same section, or in none; a run outside every section also ends after `breakAfter`.
function runs<T extends PartSection>(
  lines: readonly LyricLine[],
  sections: readonly T[],
  breakAfter: ReadonlySet<string> = new Set(),
): Run<T>[] {
  const sectionOf = new Map(sections.flatMap((section) => section.lineIds.map((id) => [id, section] as const)));
  const result: Run<T>[] = [];
  for (const line of lines) {
    const section = sectionOf.get(line.id);
    const last = result[result.length - 1];
    const ends = last && !section && breakAfter.has(last.lines[last.lines.length - 1].id);
    if (last && last.section === section && !ends) last.lines.push(line);
    else result.push({ ...(section && { section }), lines: [line] });
  }
  return result;
}

const runAnchors = (lines: readonly LyricLine[]) => lines.map((line) => line.id);

// The lines of a stretch, one unit per line or nested section, each nested section in its own `<div>` at the next
// depth.
function stretchUnits(
  lines: readonly LyricLine[],
  sections: readonly PartSection[],
  depth: number,
  writer: Writer,
  splitChar: string,
): Placed<string[]>[] {
  return runs(lines, sections).flatMap(({ section, lines: runLines }) =>
    section
      ? [{ out: sectionLines(section, runLines, depth, writer, splitChar), anchors: runAnchors(runLines) }]
      : runLines.map((line) => ({
          out: [paragraph(line, writer.source, writer.ind(depth), splitChar)],
          anchors: [line.id],
        })),
  );
}

// A song part or nested section; its kept elements are written once, among its first run.
function sectionLines(
  section: PartSection,
  lines: LyricLine[],
  depth: number,
  writer: Writer,
  splitChar: string,
): string[] {
  const kept = section.passthrough;
  const times = keptTimesAttributes(kept?.times, () => partEnvelope(lines));
  const songPart = section.kind !== undefined ? ` itunes:songPart="${escapeXmlAttribute(section.kind)}"` : "";
  const firstRun = !writer.written.has(section);
  writer.written.add(section);
  const units = stretchUnits(lines, section.sections ?? [], depth + 1, writer, splitChar);
  return [
    `${writer.ind(depth)}<div${times}${songPart}${keptAttributes(kept)}>`,
    ...(firstRun
      ? keptAmongLines(units, kept, writer.ind(depth + 1), writer.lineOrder)
      : units.flatMap((unit) => unit.out)),
    `${writer.ind(depth)}</div>`,
  ];
}

function divLines(run: Run<Part>, writer: Writer, splitChar: string): string[] {
  if (run.section) return sectionLines(run.section, run.lines, 2, writer, splitChar);
  const { ind, source } = writer;
  return [`${ind(2)}<div>`, ...run.lines.map((line) => paragraph(line, source, ind(3), splitChar)), `${ind(2)}</div>`];
}

// -- Body ---------------------------------------------------------------------

// The written lines that body elements follow: a plain `<div>` ends after each, so the element stays after its line.
function bodyBreaks(source: BodySource, written: readonly LyricLine[], lineOrder: readonly string[]): Set<string> {
  const after = source.passthrough?.body?.elementsAfter;
  if (!after) return new Set();
  const writtenIds = new Set(runAnchors(written));
  const resolve = anchorResolver(lineOrder, (id) => writtenIds.has(id));
  return new Set(after.flatMap((anchor) => (anchor === null ? [] : (resolve(anchor) ?? []))));
}

// A project without song parts writes every line in one `<div>`.
function bodyLines(source: BodySource, ind: Indent, splitChar: string): string[] {
  const durAttr = source.duration ? ` dur="${formatTime(source.duration)}"` : "";
  const written = source.lines.filter((line) => effectiveBounds(line) && isExportedLine(line, splitChar));
  const lineOrder = runAnchors(source.lines);
  const writer: Writer = { source, ind, written: new Set(), lineOrder };
  const divs = runs(written, source.parts ?? [], bodyBreaks(source, written, lineOrder)).map((run) => ({
    out: divLines(run, writer, splitChar),
    anchors: runAnchors(run.lines),
  }));
  return [
    `${ind(1)}<body${durAttr}${keptAttributes(source.passthrough?.body)}>`,
    ...keptAmongLines(
      divs.length > 0 ? divs : [{ out: [`${ind(2)}<div>`, `${ind(2)}</div>`], anchors: [] }],
      source.passthrough?.body,
      ind(2),
      lineOrder,
    ),
    `${ind(1)}</body>`,
  ];
}

// -- Exports ------------------------------------------------------------------

export { bodyLines };
