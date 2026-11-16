import { drawnSyllables, drawnUntimedSyllables } from "insync/line-drawn-track";
import type { Agent } from "insync/agent";
import { effectiveBounds } from "insync/line-bounds";
import type { LyricLine, TrackRole } from "insync/line";
import { isWordSynced } from "insync/line-predicates";
import { backgroundTrack, mainTrack } from "insync/line-track";
import type { ProjectMetadata } from "insync/metadata";
import type { Bounds } from "insync/word-bounds";
import { spacedText } from "insync/word-spaced-words";
import type { WordTiming } from "insync/word-timing";
import { withTrailingSpace } from "insync/word-spaces";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface LyricsWriterInput {
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
}

interface WritableLine {
  agentId: string;
  bounds: Bounds;
  words: WordTiming[];
  // The same words as LRC and SRT write them: a partly synced track's untimed rest follows its last timed word.
  writtenWords: WordTiming[];
  text: string;
  hasWordTiming: boolean;
}

interface WritableBackground {
  words: WordTiming[];
  writtenWords: WordTiming[];
}

// -- Helpers ------------------------------------------------------------------

function parenthesized(words: WordTiming[]): WordTiming[] {
  const first = words[0];
  const last = words.at(-1);
  if (!first || !last || (first.text.startsWith("(") && last.text.endsWith(")"))) return words;
  if (words.length === 1) return [{ ...first, text: `(${first.text})`, sep: "" }];
  return [{ ...first, text: `(${first.text}` }, ...words.slice(1, -1), { ...last, text: `${last.text})`, sep: "" }];
}

function withUntimedRest(words: WordTiming[], line: LyricLine, role: TrackRole): WordTiming[] {
  const last = words.at(-1);
  const rest = spacedText(drawnUntimedSyllables(line, role)).trimEnd();
  if (!last || !rest.trim()) return words;
  return [...words.slice(0, -1), { ...last, text: last.text + last.sep + rest, sep: "" }];
}

function backgroundOf(line: LyricLine, bounds: Bounds): WritableBackground {
  const timed = drawnSyllables(line, "bg", getSplitCharacter());
  if (timed.length) {
    return { words: parenthesized(timed), writtenWords: parenthesized(withUntimedRest(timed, line, "bg")) };
  }
  const text = spacedText(backgroundTrack(line)?.syllables ?? []).trim();
  const words = text
    ? parenthesized([{ id: "background", text, sep: "", begin: bounds.begin, end: bounds.end, joinsNext: false }])
    : [];
  return { words, writtenWords: words };
}

function withBackground(main: WordTiming[], background: WordTiming[]): WordTiming[] {
  return background.length > 0 ? [...withTrailingSpace(main), ...background] : main;
}

// Background vocals follow the main words in parentheses: every target format
// holds one text track per line.
function writableLines(lines: readonly LyricLine[]): WritableLine[] {
  return lines.flatMap((line) => {
    const bounds = effectiveBounds(line);
    if (!bounds) return [];
    const main = drawnSyllables(line, "main", getSplitCharacter()).filter((word) => word.text.trim().length > 0);
    const background = backgroundOf(line, bounds);
    const words = withBackground(main, background.words);
    if (words.length === 0) return [];
    const writtenWords = withBackground(withUntimedRest(main, line, "main"), background.writtenWords);
    return [
      {
        agentId: mainTrack(line).agentId,
        bounds,
        words,
        writtenWords,
        text: writtenWords
          .map((word) => word.text + word.sep)
          .join("")
          .trim(),
        hasWordTiming: isWordSynced(line) || Boolean(drawnSyllables(line, "bg", getSplitCharacter()).length),
      },
    ];
  });
}

function songTags(metadata: ProjectMetadata): string[] {
  const tags: [string, string][] = [
    ["ti", metadata.title],
    ["ar", metadata.artists.join(", ")],
    ["al", metadata.album],
  ];
  return tags.flatMap(([tag, value]) => (value.trim() ? [`[${tag}:${value.trim()}]`] : []));
}

// -- Exports ------------------------------------------------------------------

export { songTags, writableLines };
export type { LyricsWriterInput, WritableLine };
