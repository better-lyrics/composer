import type { Part, PartSection } from "insync/part";
import type { DocPassthrough } from "insync/passthrough";
import { escapeXmlAttribute } from "insync/xml-node";
import { bgBounds, effectiveBounds } from "@/domain/line/bounds";
import { drawnSyllables } from "@/domain/line/drawn-track";
import type { LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";
import { formatTime } from "@/utils/format-time";
import type { Indent } from "@/utils/ttml-head";
import { backgroundEnvelope, lineEnvelope, partEnvelope, writtenTimes } from "@/utils/ttml-kept-times";
import { isExportedLine } from "@/utils/ttml-line-keys";
import { emitWordSpan, spanEndsInSpace, timedSpan } from "@/utils/ttml-markup";
import { keptAttributes, keptElementLines, keptInline, keptTimesAttributes } from "@/utils/ttml-passthrough-write";
import { untimedTrackContent } from "@/utils/ttml-untimed-write";

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
}

interface Run<T> {
  section?: T;
  lines: LyricLine[];
}

// -- Paragraphs ---------------------------------------------------------------

function spans(words: readonly WordTiming[]): string {
  let content = "";
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const needsSpace = i < words.length - 1 && word.sep.endsWith(" ") && !spanEndsInSpace(word.text, word.passthrough);
    content += `${emitWordSpan(word, word.text, word.passthrough)}${needsSpace ? " " : ""}`;
  }
  return content;
}

function backgroundSpan(line: LyricLine, writesWords: boolean): string {
  const bgText = backgroundText(line);
  if (!bgText) return "";
  const background = backgroundTrack(line);
  const bgWords = timedSyllables(background);
  const kept = background?.passthrough;
  const open = `<span ttm:role="x-bg"${keptTimesAttributes(kept?.times, () => backgroundEnvelope(line))}${keptAttributes(kept)}>`;
  if (writesWords && bgWords.length) return `${open}${spans(bgWords)}${keptInline(kept)}</span>`;
  const bgTiming = bgBounds(line) ?? effectiveBounds(line);
  if (!bgTiming) return "";
  const explicit = drawnSyllables(line, "bg")[0]?.explicit;
  return `${open}${timedSpan({ ...bgTiming, explicit }, untimedTrackContent(background, bgText))}${keptInline(kept)}</span>`;
}

function paragraph(line: LyricLine, source: BodySource, indent: string): string {
  const envelope = lineEnvelope(line) ?? ["", ""];
  const [keptBegin, keptEnd] = line.passthrough?.times ? writtenTimes(line.passthrough.times, envelope) : [];
  const [begin, end] = [keptBegin ?? envelope[0], keptEnd ?? envelope[1]];
  const agentAttr = mainTrack(line).agentId ? ` ttm:agent="${escapeXmlAttribute(mainTrack(line).agentId)}"` : "";
  const lineKey = source.keyById.get(line.id);
  const keyAttr = lineKey ? ` itunes:key="${lineKey}"` : "";
  const groupAttr = line.groupId
    ? ` composer:groupId="${escapeXmlAttribute(line.groupId)}" composer:instanceIdx="${line.instanceIdx ?? 0}" composer:templateLineIdx="${line.templateLineIdx ?? 0}"${line.detached ? ' composer:detached="true"' : ""}`
    : "";
  const content =
    source.writesWords && isWordSynced(line)
      ? spans(timedSyllables(mainTrack(line)))
      : untimedTrackContent(mainTrack(line), lineText(line));
  return `${indent}<p begin="${escapeXmlAttribute(begin)}" end="${escapeXmlAttribute(end)}"${keyAttr}${agentAttr}${groupAttr}${keptAttributes(line.passthrough)}>${content}${backgroundSpan(line, source.writesWords)}${keptInline(line.passthrough)}</p>`;
}

// -- Sections -----------------------------------------------------------------

// Runs of written lines in the same section, or in none.
function runs<T extends PartSection>(lines: readonly LyricLine[], sections: readonly T[]): Run<T>[] {
  const sectionOf = new Map(sections.flatMap((section) => section.lineIds.map((id) => [id, section] as const)));
  const result: Run<T>[] = [];
  for (const line of lines) {
    const section = sectionOf.get(line.id);
    const last = result[result.length - 1];
    if (last && last.section === section) last.lines.push(line);
    else result.push({ ...(section && { section }), lines: [line] });
  }
  return result;
}

// The lines of a stretch, each nested section in its own `<div>` at the next depth.
function stretchLines(lines: readonly LyricLine[], sections: readonly PartSection[], depth: number, writer: Writer) {
  return runs(lines, sections).flatMap(({ section, lines: runLines }) =>
    section
      ? sectionLines(section, runLines, depth, writer)
      : runLines.map((line) => paragraph(line, writer.source, writer.ind(depth))),
  );
}

// A song part or nested section; its kept elements are written once, after its first run.
function sectionLines(section: PartSection, lines: LyricLine[], depth: number, writer: Writer): string[] {
  const kept = section.passthrough;
  const times = keptTimesAttributes(kept?.times, () => partEnvelope(lines));
  const songPart = section.kind !== undefined ? ` itunes:songPart="${escapeXmlAttribute(section.kind)}"` : "";
  const firstRun = !writer.written.has(section);
  writer.written.add(section);
  return [
    `${writer.ind(depth)}<div${times}${songPart}${keptAttributes(kept)}>`,
    ...stretchLines(lines, section.sections ?? [], depth + 1, writer),
    ...(firstRun ? keptElementLines(kept, writer.ind(depth + 1)) : []),
    `${writer.ind(depth)}</div>`,
  ];
}

function divLines(run: Run<Part>, writer: Writer): string[] {
  if (run.section) return sectionLines(run.section, run.lines, 2, writer);
  const { ind, source } = writer;
  return [`${ind(2)}<div>`, ...run.lines.map((line) => paragraph(line, source, ind(3))), `${ind(2)}</div>`];
}

// -- Body ---------------------------------------------------------------------

// A project without song parts writes every line in one `<div>`.
function bodyLines(source: BodySource, ind: Indent): string[] {
  const durAttr = source.duration ? ` dur="${formatTime(source.duration)}"` : "";
  const written = source.lines.filter((line) => effectiveBounds(line) && isExportedLine(line));
  const writer: Writer = { source, ind, written: new Set() };
  const divs = runs(written, source.parts ?? []).flatMap((run) => divLines(run, writer));
  return [
    `${ind(1)}<body${durAttr}${keptAttributes(source.passthrough?.body)}>`,
    ...(divs.length > 0 ? divs : [`${ind(2)}<div>`, `${ind(2)}</div>`]),
    ...keptElementLines(source.passthrough?.body, ind(2)),
    `${ind(1)}</body>`,
  ];
}

// -- Exports ------------------------------------------------------------------

export { bodyLines };
