import type { LyricLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { backgroundText, lineText } from "@/domain/line/text";

interface ParsedLine {
  lineNumber: number;
  lineId: string;
  text: string;
  isEmpty: boolean;
  hasBrackets: boolean;
  hasTiming: boolean;
  agentId: string;
  backgroundText?: string;
  groupId?: string;
  instanceIdx?: number;
  templateLineIdx?: number;
}

function parseLyrics(text: string, lines: LyricLine[], defaultAgentId: string): ParsedLine[] {
  const textLines = text.split("\n");
  const nonEmptyStored = lines.filter((l) => lineText(l) !== "");
  let nonEmptyIndex = 0;

  return textLines.map((line, index) => {
    const trimmed = line.trim();
    const isEmpty = trimmed === "";
    const lyricLine = isEmpty ? undefined : nonEmptyStored[nonEmptyIndex++];
    const hasTiming = lyricLine !== undefined && (isLineSynced(lyricLine) || isWordSynced(lyricLine));

    return {
      lineNumber: index + 1,
      lineId: lyricLine?.id ?? "",
      text: lyricLine ? lineText(lyricLine) : line,
      isEmpty,
      hasBrackets: /\[.*?\]/.test(line),
      hasTiming,
      agentId: lyricLine?.agentId ?? defaultAgentId,
      backgroundText: lyricLine && backgroundText(lyricLine),
      groupId: lyricLine?.groupId,
      instanceIdx: lyricLine?.instanceIdx,
      templateLineIdx: lyricLine?.templateLineIdx,
    };
  });
}

export { parseLyrics };
export type { ParsedLine };
