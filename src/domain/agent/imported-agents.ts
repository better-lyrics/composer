import { agentWithoutKeptData } from "insync/agent-kept-data";
import type { Agent } from "insync/agent";
import type { LyricLine } from "insync/line";
import { mainTrack } from "insync/line-track";
import { withAgent } from "insync/line-track-writes";

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

// An import replaces kept TTML data: a singer it declares brings its own, every other singer keeps none.
function updatedAgent(agent: Agent, update: Agent): Agent {
  return {
    ...agentWithoutKeptData(agent),
    name: update.name,
    type: update.type,
    ...(update.passthrough && { passthrough: update.passthrough }),
    ...(update.namePassthrough && { namePassthrough: update.namePassthrough }),
  };
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
    if (update) return [updatedAgent(agent, update)];
    return referenced.has(agent.id) ? [agentWithoutKeptData(agent)] : [];
  });
  const existingIds = new Set(existing.map((agent) => agent.id));
  const added = declared.filter((agent) => !existingIds.has(agent.id));
  const agents = [...kept, ...added];
  return { agents: agents.length > 0 ? agents : existing.map(agentWithoutKeptData), lines };
}

// -- Exports ------------------------------------------------------------------

export { agentsAfterImport };
