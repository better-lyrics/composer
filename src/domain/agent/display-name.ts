import type { Agent } from "@/domain/agent/model";

// -- Functions ----------------------------------------------------------------

function agentDisplayName(agent: Pick<Agent, "id" | "name">): string {
  return agent.name || agent.id;
}

// -- Exports ------------------------------------------------------------------

export { agentDisplayName };
