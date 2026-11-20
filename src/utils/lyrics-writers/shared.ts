import type { Agent } from "@/domain/agent/model";
import { effectiveBounds } from "@/domain/line/bounds";
import { effectiveWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { Bounds } from "@/domain/word/bounds";
import { spacedText } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { withTrailingSpace } from "@/utils/word-spaces";

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
  if (line.backgroundWords?.length) return parenthesized(line.backgroundWords);
  const text = line.backgroundText?.trim();
  return text ? parenthesized([{ text, sep: "", begin: bounds.begin, end: bounds.end }]) : [];
}

// Background vocals follow the main words in parentheses: every target format
// holds one text track per line.
function writableLines(lines: readonly LyricLine[]): WritableLine[] {
  return lines.flatMap((line) => {
    const bounds = effectiveBounds(line);
    if (!bounds) return [];
    const main = effectiveWords(line).filter((word) => word.text.trim().length > 0);
    const background = backgroundWordsOf(line, bounds);
    const words = background.length > 0 ? [...withTrailingSpace(main), ...background] : main;
    if (words.length === 0) return [];
    return [
      {
        agentId: line.agentId,
        bounds,
        words,
        text: spacedText(words).trim(),
        hasWordTiming: isWordSynced(line) || Boolean(line.backgroundWords?.length),
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
