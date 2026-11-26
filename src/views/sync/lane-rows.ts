import { getAgentColor } from "@/domain/agent/colors";
import { agentDisplayName } from "@/domain/agent/display-name";
import type { Agent } from "@/domain/agent/model";
import type { LanguageDisplayLine } from "@/domain/language/display";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { getSplitCharacter } from "@/utils/split-character";
import { splitIntoWords, splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import type { LaneGroupTag } from "@/views/sync/shared-sync-tags";

// -- Interfaces ---------------------------------------------------------------

interface LaneSinger {
  name: string;
  color: string;
}

interface WordRun {
  start: number;
  end: number;
}

interface LaneRow {
  line: LyricLine;
  lineIndex: number;
  text: string;
  wordTexts: string[];
  wordRuns: WordRun[];
  backgroundText?: string;
  singer?: LaneSinger;
  groupTag?: LaneGroupTag;
  folded: boolean;
}

interface LineWords {
  display: LanguageDisplayLine;
  splitCharacter: string;
  wordTexts: string[];
  wordRuns: WordRun[];
}

interface LaneRowsInput {
  lines: readonly LyricLine[];
  displayLines: readonly LanguageDisplayLine[];
  agents: readonly Agent[];
  groupTags: ReadonlyMap<string, LaneGroupTag>;
  folded: ReadonlySet<string>;
}

// -- Cache --------------------------------------------------------------------

// A tap replaces one line object, so every other line keeps its split words and its row.
const wordsByLine = new WeakMap<LyricLine, LineWords>();
const rowByLine = new WeakMap<LyricLine, LaneRow>();

// -- Functions ----------------------------------------------------------------

function laneSinger(agentId: string, agents: readonly Agent[]): LaneSinger {
  const agent = agents.find((candidate) => candidate.id === agentId);
  return { name: agent ? agentDisplayName(agent) : agentId, color: getAgentColor(agentId) };
}

// Syllables split from one word share a run, so the lane spaces words apart and keeps syllables joined.
function wordRunsOf(text: string, slotCount: number): WordRun[] {
  const { trailingSpace } = splitIntoWordsWithMeta(text);
  const runs: WordRun[] = [];
  let start = 0;
  for (let index = 0; index < slotCount; index++) {
    const endsWord = trailingSpace.length !== slotCount || trailingSpace[index] || index === slotCount - 1;
    if (!endsWord) continue;
    runs.push({ start, end: index });
    start = index + 1;
  }
  return runs;
}

function lineWords(line: LyricLine, display: LanguageDisplayLine): LineWords {
  const splitCharacter = getSplitCharacter();
  const cached = wordsByLine.get(line);
  if (cached?.display === display && cached.splitCharacter === splitCharacter) return cached;
  const wordTexts = display.wordTexts ?? splitIntoWords(display.text);
  const words = { display, splitCharacter, wordTexts, wordRuns: wordRunsOf(lineText(line), wordTexts.length) };
  wordsByLine.set(line, words);
  return words;
}

function sameSinger(a: LaneSinger | undefined, b: LaneSinger | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && a.name === b.name && a.color === b.color);
}

function reusedRow(previous: LaneRow | undefined, next: LaneRow): LaneRow {
  const unchanged =
    previous !== undefined &&
    previous.lineIndex === next.lineIndex &&
    previous.wordTexts === next.wordTexts &&
    previous.text === next.text &&
    previous.backgroundText === next.backgroundText &&
    previous.groupTag === next.groupTag &&
    previous.folded === next.folded &&
    sameSinger(previous.singer, next.singer);
  return unchanged ? previous : next;
}

function buildLaneRows({ lines, displayLines, agents, groupTags, folded }: LaneRowsInput): LaneRow[] {
  const showsSingers = new Set(lines.map((line) => line.agentId)).size > 1;
  let previousAgentId: string | null = null;
  return lines.map((line, lineIndex) => {
    const display = displayLines[lineIndex] ?? line;
    const isFolded = folded.has(line.id);
    const singerChanged = !isFolded && line.agentId !== previousAgentId;
    if (!isFolded) previousAgentId = line.agentId;
    const { wordTexts, wordRuns } = lineWords(line, display);
    const row = reusedRow(rowByLine.get(line), {
      line,
      lineIndex,
      text: display.text,
      wordTexts,
      wordRuns,
      backgroundText: display.backgroundText,
      singer: showsSingers && singerChanged ? laneSinger(line.agentId, agents) : undefined,
      groupTag: groupTags.get(line.id),
      folded: isFolded,
    });
    rowByLine.set(line, row);
    return row;
  });
}

// -- Exports ------------------------------------------------------------------

export { buildLaneRows };
export type { LaneRow };
