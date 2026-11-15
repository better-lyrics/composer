import { drawnSyllables } from "@/domain/line/drawn-track";
import type { Agent } from "insync/agent";
import { effectiveBounds } from "insync/line-bounds";
import type { LyricLine } from "insync/line";
import { isWordSynced } from "@/domain/line/predicates";
import { backgroundText } from "@/domain/line/text";
import { mainTrack } from "insync/line-track";
import type { ProjectMetadata } from "insync/metadata";
import type { Bounds } from "insync/word-bounds";
import { spacedText } from "@/domain/word/spaced-words";
import type { WordTiming } from "insync/word-timing";
import { withTrailingSpace } from "@/utils/word-spaces";
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
  text: string;
  hasWordTiming: boolean;
}

// -- Helpers ------------------------------------------------------------------

function parenthesized(words: WordTiming[]): WordTiming[] {
  const first = words[0];
  const last = words.at(-1);
  if (!first || !last || (first.text.startsWith("(") && last.text.endsWith(")"))) return words;
  if (words.length === 1) return [{ ...first, text: `(${first.text})`, sep: "" }];
  return [{ ...first, text: `(${first.text}` }, ...words.slice(1, -1), { ...last, text: `${last.text})`, sep: "" }];
}

function backgroundWordsOf(line: LyricLine, bounds: Bounds): WordTiming[] {
  const timed = drawnSyllables(line, "bg", getSplitCharacter());
  if (timed.length) return parenthesized(timed);
  const text = backgroundText(line, getSplitCharacter())?.trim();
  return text
    ? parenthesized([{ id: "background", text, sep: "", begin: bounds.begin, end: bounds.end, joinsNext: false }])
    : [];
}

// Background vocals follow the main words in parentheses: every target format
// holds one text track per line.
function writableLines(lines: readonly LyricLine[]): WritableLine[] {
  return lines.flatMap((line) => {
    const bounds = effectiveBounds(line);
    if (!bounds) return [];
    const main = drawnSyllables(line, "main", getSplitCharacter()).filter((word) => word.text.trim().length > 0);
    const background = backgroundWordsOf(line, bounds);
    const words = background.length > 0 ? [...withTrailingSpace(main), ...background] : main;
    if (words.length === 0) return [];
    return [
      {
        agentId: mainTrack(line).agentId,
        bounds,
        words,
        text: spacedText(words).trim(),
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
