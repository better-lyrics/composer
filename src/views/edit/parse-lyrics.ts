import { type BackgroundBracketRefusal, backgroundBracketRefusals } from "insync/background-vocal-refusals";
import { shownRow } from "insync/edit-text-shown-row";
import { mainTrack } from "insync/line-track";
import type { LyricLine } from "insync/line";
import { isLineSynced, isWordSynced } from "insync/line-predicates";
import { backgroundText, lineText } from "insync/line-text";
import { getSplitCharacter } from "@/utils/split-character";

interface ParsedLine {
  lineNumber: number;
  lineId: string;
  text: string;
  isEmpty: boolean;
  hasBrackets: boolean;
  backgroundBracketRefusal?: BackgroundBracketRefusal;
  hasTiming: boolean;
  agentId: string;
  backgroundText?: string;
  groupId?: string;
  instanceIdx?: number;
  templateLineIdx?: number;
}

function parseLyrics(text: string, lines: LyricLine[], defaultAgentId: string): ParsedLine[] {
  const textLines = text.split("\n");
  const nonEmptyStored = lines.filter((l) => shownRow(l, getSplitCharacter()).text !== "");
  const backgroundRefusals = backgroundBracketRefusals(lines, getSplitCharacter());
  let nonEmptyIndex = 0;

  return textLines.map((line, index) => {
    const trimmed = line.trim();
    const isEmpty = trimmed === "";
    const lyricLine = isEmpty ? undefined : nonEmptyStored[nonEmptyIndex++];
    const hasTiming = lyricLine !== undefined && (isLineSynced(lyricLine) || isWordSynced(lyricLine));

    return {
      lineNumber: index + 1,
      lineId: lyricLine?.id ?? "",
      text: lyricLine ? lineText(lyricLine, getSplitCharacter()) : line,
      isEmpty,
      hasBrackets: /\[.*?\]/.test(line),
      backgroundBracketRefusal: lyricLine && backgroundRefusals.get(lyricLine.id),
      hasTiming,
      agentId: (lyricLine && mainTrack(lyricLine).agentId) ?? defaultAgentId,
      backgroundText: lyricLine && backgroundText(lyricLine, getSplitCharacter()),
      groupId: lyricLine?.groupId,
      instanceIdx: lyricLine?.instanceIdx,
      templateLineIdx: lyricLine?.templateLineIdx,
    };
  });
}

export { parseLyrics };
export type { ParsedLine };
