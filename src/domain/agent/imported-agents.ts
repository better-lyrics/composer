import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import { mainTrack } from "@/domain/line/track";
import { withAgent } from "@/domain/line/track-writes";

// -- Constants ----------------------------------------------------------------

const FALLBACK_AGENT_ID = "v1";

// -- Types --------------------------------------------------------------------

interface ImportedAgentAssignment<L extends LyricLine> {
  agents: Agent[];
  lines: L[];
}

// -- Helpers ------------------------------------------------------------------

function linesOnExistingAgents<L extends LyricLine>(existing: readonly Agent[], lines: readonly L[]): L[] {
  const existingIds = new Set(existing.map((agent) => agent.id));
  const defaultAgentId = existing[0]?.id ?? FALLBACK_AGENT_ID;
  return lines.map((line) =>
    existingIds.has(mainTrack(line).agentId) ? line : { ...line, ...withAgent(line, defaultAgentId) },
  );
}

// -- Functions ----------------------------------------------------------------

function agentsAfterImport<L extends LyricLine>(
  existing: readonly Agent[],
  incoming: readonly Agent[] | undefined,
  importedLines: readonly L[],
): ImportedAgentAssignment<L> {
  const declared = incoming ?? [];
  const lines = declared.length > 0 ? [...importedLines] : linesOnExistingAgents(existing, importedLines);
  const incomingById = new Map(declared.map((agent) => [agent.id, agent] as const));
  const referenced = new Set(lines.map((line) => mainTrack(line).agentId));
  const kept = existing.flatMap((agent) => {
    const update = incomingById.get(agent.id);
    if (update) return [{ ...agent, name: update.name, type: update.type }];
    return referenced.has(agent.id) ? [agent] : [];
  });
  const existingIds = new Set(existing.map((agent) => agent.id));
  const added = declared.filter((agent) => !existingIds.has(agent.id));
  const agents = [...kept, ...added];
  return { agents: agents.length > 0 ? agents : [...existing], lines };
}

// -- Exports ------------------------------------------------------------------

export { agentsAfterImport };
