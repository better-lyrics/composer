import type { Agent } from "./agent";

// -- Functions ----------------------------------------------------------------

function agentDisplayName(agent: Pick<Agent, "id" | "name">): string {
  return agent.name || agent.id;
}

// -- Exports ------------------------------------------------------------------

export { agentDisplayName };
