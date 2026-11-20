import type { Passthrough } from "insync/passthrough";

// -- Types --------------------------------------------------------------------

type AgentType = "person" | "character" | "group" | "organization" | "other";

interface Agent {
  id: string;
  type: AgentType;
  name?: string;
  passthrough?: Passthrough;
}

// -- Exports ------------------------------------------------------------------

export type { Agent, AgentType };
