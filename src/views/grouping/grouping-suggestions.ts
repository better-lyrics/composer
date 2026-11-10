import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";
import { type RepeatingSection, findRepeatingStandaloneSections } from "@/views/grouping/repeating-sections";

// -- Interfaces ----------------------------------------------------------------

interface LastScan {
  lines: LyricLine[];
  splitChar: string;
  settingsSplitChar: string;
  sections: RepeatingSection[];
}

// -- State ---------------------------------------------------------------------

let lastScan: LastScan | null = null;

// -- Helpers -------------------------------------------------------------------

function sameWordTexts(a: readonly WordTiming[] | undefined, b: readonly WordTiming[] | undefined): boolean {
  if (a === b) return true;
  const length = a?.length ?? 0;
  if (length !== (b?.length ?? 0)) return false;
  for (let i = 0; i < length; i++) if (a?.[i].text !== b?.[i].text) return false;
  return true;
}

// Exactly the fields findRepeatingStandaloneSections reads, so timing edits reuse the last scan.
function sameScanInputLine(a: LyricLine, b: LyricLine): boolean {
  return (
    a === b ||
    (a.text === b.text &&
      a.agentId === b.agentId &&
      a.backgroundText === b.backgroundText &&
      (a.groupId === undefined) === (b.groupId === undefined) &&
      sameWordTexts(a.words, b.words) &&
      sameWordTexts(a.backgroundWords, b.backgroundWords))
  );
}

function sameScanInput(a: readonly LyricLine[], b: readonly LyricLine[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!sameScanInputLine(a[i], b[i])) return false;
  return true;
}

// -- Functions -----------------------------------------------------------------

function groupingSuggestions(lines: LyricLine[], splitChar: string): RepeatingSection[] {
  const settingsSplitChar = getSplitCharacter();
  if (
    lastScan &&
    lastScan.splitChar === splitChar &&
    lastScan.settingsSplitChar === settingsSplitChar &&
    sameScanInput(lastScan.lines, lines)
  ) {
    lastScan.lines = lines;
    return lastScan.sections;
  }
  const sections = findRepeatingStandaloneSections(lines, splitChar);
  lastScan = { lines, splitChar, settingsSplitChar, sections };
  return sections;
}

// -- Exports -------------------------------------------------------------------

export { groupingSuggestions };
