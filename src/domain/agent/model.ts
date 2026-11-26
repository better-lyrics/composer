import type { Passthrough } from "insync/passthrough";

// -- Types --------------------------------------------------------------------

type AgentType = "person" | "character" | "group" | "organization" | "other";

interface Agent {
  id: string;
  type: AgentType;
  name?: string;
  passthrough?: Passthrough;
  // The unmodelled data of its `<ttm:name>`.
  namePassthrough?: Passthrough;
}

// -- Exports ------------------------------------------------------------------

export type { Agent, AgentType };
