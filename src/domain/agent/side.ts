// -- Types --------------------------------------------------------------------

type AgentSide = "left" | "right" | "center";

// -- Functions ----------------------------------------------------------------

// Same sides as Braccato's lyrics.css, so Sync reads like Preview.
function agentSide(agentId: string): AgentSide {
  if (agentId === "v2" || agentId === "v3") return "right";
  if (agentId === "v1000") return "center";
  return "left";
}

// -- Exports ------------------------------------------------------------------

export { agentSide };
export type { AgentSide };
