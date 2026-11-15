import type { Agent } from "insync/agent";

// -- Functions ----------------------------------------------------------------

function agentDisplayName(agent: Pick<Agent, "id" | "name">): string {
  return agent.name || agent.id;
}

// -- Exports ------------------------------------------------------------------

export { agentDisplayName };
