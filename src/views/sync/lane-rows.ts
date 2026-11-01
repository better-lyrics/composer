import { getAgentColor } from "@/domain/agent/colors";
import { agentDisplayName } from "@/domain/agent/display-name";
import type { Agent } from "@/domain/agent/model";
import { type AgentSide, agentSide } from "@/domain/agent/side";
import type { LanguageDisplayLine } from "@/domain/language/display";
import type { LyricLine } from "@/domain/line/model";
import { isLineTimed, timedWordCount } from "@/domain/line/sync-progress";
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
  side: AgentSide;
  singer?: LaneSinger;
  groupTag?: LaneGroupTag;
  folded: boolean;
  isTimed: boolean;
  timedWords: number;
}

interface LaneRowsInput {
  lines: readonly LyricLine[];
  displayLines: readonly LanguageDisplayLine[];
  agents: readonly Agent[];
  groupTags: ReadonlyMap<string, LaneGroupTag>;
  folded: ReadonlySet<string>;
}

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

function buildLaneRows({ lines, displayLines, agents, groupTags, folded }: LaneRowsInput): LaneRow[] {
  const showsSingers = new Set(lines.map((line) => line.agentId)).size > 1;
  let previousAgentId: string | null = null;
  return lines.map((line, lineIndex) => {
    const display = displayLines[lineIndex] ?? line;
    const isFolded = folded.has(line.id);
    const singerChanged = !isFolded && line.agentId !== previousAgentId;
    if (!isFolded) previousAgentId = line.agentId;
    const wordTexts = display.wordTexts ?? splitIntoWords(display.text);
    return {
      line,
      lineIndex,
      text: display.text,
      wordTexts,
      wordRuns: wordRunsOf(line.text, wordTexts.length),
      backgroundText: display.backgroundText,
      side: agentSide(line.agentId),
      singer: showsSingers && singerChanged ? laneSinger(line.agentId, agents) : undefined,
      groupTag: groupTags.get(line.id),
      folded: isFolded,
      isTimed: isLineTimed(line),
      timedWords: timedWordCount(line),
    };
  });
}

// -- Exports ------------------------------------------------------------------

export { buildLaneRows };
export type { LaneRow, WordRun };
