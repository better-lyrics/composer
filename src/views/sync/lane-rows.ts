import { getAgentColor } from "@/domain/agent/colors";
import { agentDisplayName } from "@/domain/agent/display-name";
import type { Agent } from "@/domain/agent/model";
import { type AgentSide, agentSide } from "@/domain/agent/side";
import type { LanguageDisplayLine } from "@/domain/language/display";
import type { LyricLine } from "@/domain/line/model";
import { isLineTimed, timedWordCount } from "@/domain/line/sync-progress";
import { splitIntoWords } from "@/utils/sync-helpers";
import type { LaneGroupTag } from "@/views/sync/shared-sync-tags";

// -- Interfaces ---------------------------------------------------------------

interface LaneSinger {
  name: string;
  color: string;
}

interface LaneRow {
  line: LyricLine;
  lineIndex: number;
  text: string;
  wordTexts: string[];
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

function buildLaneRows({ lines, displayLines, agents, groupTags, folded }: LaneRowsInput): LaneRow[] {
  const showsSingers = new Set(lines.map((line) => line.agentId)).size > 1;
  let previousAgentId: string | null = null;
  return lines.map((line, lineIndex) => {
    const display = displayLines[lineIndex] ?? line;
    const isFolded = folded.has(line.id);
    const singerChanged = !isFolded && line.agentId !== previousAgentId;
    if (!isFolded) previousAgentId = line.agentId;
    return {
      line,
      lineIndex,
      text: display.text,
      wordTexts: display.wordTexts ?? splitIntoWords(display.text),
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
export type { LaneRow };
