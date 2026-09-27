import type { Agent } from "@/domain/agent/model";

// -- Functions ----------------------------------------------------------------

function agentsAfterImport(
  existing: readonly Agent[],
  incoming: readonly Agent[] | undefined,
  lines: readonly { agentId: string }[],
): Agent[] {
  const incomingById = new Map((incoming ?? []).map((agent) => [agent.id, agent] as const));
  const referenced = new Set(lines.map((line) => line.agentId));
  const kept = existing.flatMap((agent) => {
    const update = incomingById.get(agent.id);
    if (update) return [{ ...agent, name: update.name, type: update.type }];
    return referenced.has(agent.id) ? [agent] : [];
  });
  const existingIds = new Set(existing.map((agent) => agent.id));
  const added = (incoming ?? []).filter((agent) => !existingIds.has(agent.id));
  const result = [...kept, ...added];
  return result.length > 0 ? result : [...existing];
}

// -- Exports ------------------------------------------------------------------

export { agentsAfterImport };
