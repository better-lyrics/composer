import type { Part } from "insync/part";
import type { DocPassthrough } from "insync/passthrough";
import { escapeXmlAttribute, escapeXmlText } from "insync/xml-node";
import { bgBounds, effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";
import { formatTime } from "@/utils/format-time";
import { stripSplitCharacter } from "@/utils/split-character";
import type { Indent } from "@/utils/ttml-head";
import { backgroundEnvelope, lineEnvelope, partEnvelope, writtenTimes } from "@/utils/ttml-kept-times";
import { isExportedLine } from "@/utils/ttml-line-keys";
import { emitWordSpan, spanEndsInSpace } from "@/utils/ttml-markup";
import { keptAttributes, keptElementLines, keptInline, keptTimesAttributes } from "@/utils/ttml-passthrough-write";

// -- Types --------------------------------------------------------------------

interface BodySource {
  lines: readonly LyricLine[];
  keyById: ReadonlyMap<string, string>;
  writesWords: boolean;
  duration?: number;
  parts?: readonly Part[];
  passthrough?: DocPassthrough;
}

interface Section {
  part?: Part;
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
  return `${open}<span begin="${formatTime(bgTiming.begin)}" end="${formatTime(bgTiming.end)}">${escapeXmlText(stripSplitCharacter(bgText))}</span>${keptInline(kept)}</span>`;
}

function paragraph(line: LyricLine, source: BodySource, ind: Indent): string {
  const envelope = lineEnvelope(line) ?? ["", ""];
  const [begin, end] = line.passthrough?.times ? writtenTimes(line.passthrough.times, envelope) : envelope;
  const agentAttr = mainTrack(line).agentId ? ` ttm:agent="${escapeXmlAttribute(mainTrack(line).agentId)}"` : "";
  const lineKey = source.keyById.get(line.id);
  const keyAttr = lineKey ? ` itunes:key="${lineKey}"` : "";
  const groupAttr = line.groupId
    ? ` composer:groupId="${escapeXmlAttribute(line.groupId)}" composer:instanceIdx="${line.instanceIdx ?? 0}" composer:templateLineIdx="${line.templateLineIdx ?? 0}"${line.detached ? ' composer:detached="true"' : ""}`
    : "";
  const content =
    source.writesWords && isWordSynced(line)
      ? spans(timedSyllables(mainTrack(line)))
      : escapeXmlText(stripSplitCharacter(lineText(line)));
  return `${ind(3)}<p begin="${escapeXmlAttribute(begin)}" end="${escapeXmlAttribute(end)}"${keyAttr}${agentAttr}${groupAttr}${keptAttributes(line.passthrough)}>${content}${backgroundSpan(line, source.writesWords)}${keptInline(line.passthrough)}</p>`;
}

// -- Sections -----------------------------------------------------------------

// Runs of written lines in the same song part, or in none.
function sections(lines: readonly LyricLine[], parts: readonly Part[]): Section[] {
  const partOf = new Map(parts.flatMap((part) => part.lineIds.map((id) => [id, part] as const)));
  const result: Section[] = [];
  for (const line of lines) {
    const part = partOf.get(line.id);
    const last = result[result.length - 1];
    if (last && last.part === part) last.lines.push(line);
    else result.push({ ...(part && { part }), lines: [line] });
  }
  return result;
}

function sectionLines(section: Section, source: BodySource, ind: Indent, writtenParts: Set<Part>): string[] {
  const { part } = section;
  const paragraphs = section.lines.map((line) => paragraph(line, source, ind));
  if (!part) return [`${ind(2)}<div>`, ...paragraphs, `${ind(2)}</div>`];
  const kept = part.passthrough;
  const times = keptTimesAttributes(kept?.times, () => partEnvelope(section.lines));
  const songPart = part.kind !== undefined ? ` itunes:songPart="${escapeXmlAttribute(part.kind)}"` : "";
  const firstRun = !writtenParts.has(part);
  writtenParts.add(part);
  return [
    `${ind(2)}<div${times}${songPart}${keptAttributes(kept)}>`,
    ...paragraphs,
    ...(firstRun ? keptElementLines(kept, ind(3)) : []),
    `${ind(2)}</div>`,
  ];
}

// -- Body ---------------------------------------------------------------------

// A project without song parts writes every line in one `<div>`.
function bodyLines(source: BodySource, ind: Indent): string[] {
  const durAttr = source.duration ? ` dur="${formatTime(source.duration)}"` : "";
  const written = source.lines.filter((line) => effectiveBounds(line) && isExportedLine(line));
  const runs = sections(written, source.parts ?? []);
  const writtenParts = new Set<Part>();
  const divs = runs.length > 0 ? runs.flatMap((run) => sectionLines(run, source, ind, writtenParts)) : [];
  return [
    `${ind(1)}<body${durAttr}${keptAttributes(source.passthrough?.body)}>`,
    ...(divs.length > 0 ? divs : [`${ind(2)}<div>`, `${ind(2)}</div>`]),
    ...keptElementLines(source.passthrough?.body, ind(2)),
    `${ind(1)}</body>`,
  ];
}

// -- Exports ------------------------------------------------------------------

export { bodyLines };
