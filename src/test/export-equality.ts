import { matchAllLineHeaders, matchAllWordTags } from "@/domain/lyrics-file/qrc-syntax";
import type { EditedTtmlProject } from "@/test/edited-ttml-projects";
import { LRC_CLOCK, parseLrcClock } from "@/utils/lyrics-parsers/lrc";
import { SRT_CLOCK_REGEX } from "@/utils/lyrics-parsers/srt";
import { parseTtmlTimestamp } from "@/utils/lyrics-parsers/ttml-helpers";
import { writeLrc } from "@/utils/lyrics-writers/lrc";
import { writeQrc } from "@/utils/lyrics-writers/qrc";
import type { LyricsWriterInput } from "@/utils/lyrics-writers/shared";
import { writeSrt } from "@/utils/lyrics-writers/srt";
import { generateProjectTtml } from "@/utils/ttml";

// -- Types --------------------------------------------------------------------

interface TimedText {
  // The output with every time value replaced, so everything else must match byte for byte.
  skeleton: string;
  ms: number[];
}

interface ExportFormat {
  name: string;
  write: (project: EditedTtmlProject) => string;
  times: (output: string) => TimedText;
}

interface ExportDifference {
  format: string;
  skeletonDiffers: boolean;
  timeCountDiffers: boolean;
  overOneMs: { before: number; after: number; context: string }[];
}

// -- Constants ----------------------------------------------------------------

const EXPORT_DURATION_SECONDS = 30;
const TIME_MARK = "\u0000";
// TTML clocks as `formatTime` writes them; no parser owns a pattern for them.
const TTML_CLOCK_REGEX = /\d+:\d{2}\.\d{3}/g;

// -- Times --------------------------------------------------------------------

const msOf = (seconds: number) => Math.round(seconds * 1000);

function timesOf(output: string, matches: RegExpExecArray[], toMs: (match: RegExpExecArray) => number[]): TimedText {
  let skeleton = "";
  let cursor = 0;
  const ms: number[] = [];
  for (const match of matches.toSorted((a, b) => a.index - b.index)) {
    const values = toMs(match);
    skeleton += output.slice(cursor, match.index) + TIME_MARK.repeat(values.length);
    cursor = match.index + match[0].length;
    ms.push(...values);
  }
  return { skeleton: skeleton + output.slice(cursor), ms };
}

function timesBy(output: string, regex: RegExp, toMs: (match: RegExpExecArray) => number[]): TimedText {
  return timesOf(output, [...output.matchAll(new RegExp(regex.source, "g"))], toMs);
}

const qrcTimes = (output: string): TimedText =>
  timesOf(output, [...matchAllLineHeaders(output), ...matchAllWordTags(output)], (tag) => [
    Number(tag[1]),
    Number(tag[2]),
  ]);

// -- Formats ------------------------------------------------------------------

const writerInput = ({ metadata, agents, lines }: EditedTtmlProject): LyricsWriterInput => ({
  metadata,
  agents,
  lines,
});

const EXPORT_FORMATS: readonly ExportFormat[] = [
  {
    name: "TTML word",
    write: (project) => generateProjectTtml(project, EXPORT_DURATION_SECONDS, "word"),
    times: (output) => timesBy(output, TTML_CLOCK_REGEX, (match) => [msOf(parseTtmlTimestamp(match[0]))]),
  },
  {
    name: "TTML line",
    write: (project) => generateProjectTtml(project, EXPORT_DURATION_SECONDS, "line"),
    times: (output) => timesBy(output, TTML_CLOCK_REGEX, (match) => [msOf(parseTtmlTimestamp(match[0]))]),
  },
  {
    name: "LRC",
    write: (project) => writeLrc(writerInput(project)),
    times: (output) =>
      timesBy(output, new RegExp(LRC_CLOCK), (match) => [msOf(parseLrcClock(match[1], match[2], match[3]) ?? 0)]),
  },
  {
    name: "SRT",
    write: (project) => writeSrt(writerInput(project)),
    times: (output) =>
      timesBy(output, SRT_CLOCK_REGEX, ([, hours, minutes, seconds, ms]) => [
        ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 + Number(ms),
      ]),
  },
  { name: "QRC", write: (project) => writeQrc(writerInput(project)), times: qrcTimes },
];

// -- Comparison ---------------------------------------------------------------

function contextAt(skeleton: string, index: number): string {
  let seen = -1;
  for (let at = 0; at < skeleton.length; at++) {
    if (skeleton[at] === TIME_MARK && ++seen === index) return skeleton.slice(Math.max(0, at - 60), at + 40);
  }
  return "";
}

// Everything outside time values is byte equal, and each time value moves by at most one millisecond.
function exportDifferences(before: EditedTtmlProject, after: EditedTtmlProject): ExportDifference[] {
  return EXPORT_FORMATS.flatMap((format) => {
    const was = format.times(format.write(before));
    const now = format.times(format.write(after));
    const overOneMs = was.ms.flatMap((ms, index) =>
      Math.abs(ms - (now.ms[index] ?? Number.NaN)) <= 1
        ? []
        : [{ before: ms, after: now.ms[index], context: contextAt(was.skeleton, index) }],
    );
    const skeletonDiffers = was.skeleton !== now.skeleton;
    const timeCountDiffers = was.ms.length !== now.ms.length;
    if (!skeletonDiffers && !timeCountDiffers && overOneMs.length === 0) return [];
    return [{ format: format.name, skeletonDiffers, timeCountDiffers, overOneMs }];
  });
}

// -- Exports ------------------------------------------------------------------

export type { ExportDifference };
export { exportDifferences };
