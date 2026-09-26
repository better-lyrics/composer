import { AGENT_PRESETS } from "@/domain/agent/colors";
import type { Agent } from "@/domain/agent/model";

// -- Functions ----------------------------------------------------------------

// Singer names belong to one song, but agent ids are referenced by lines, so a
// new song resets the names and keeps every agent.
function withDefaultAgentNames(agents: Agent[]): Agent[] {
  return agents.map(({ name: _songName, ...agent }) => {
    const preset = AGENT_PRESETS.find((p) => p.id === agent.id);
    return preset?.name ? { ...agent, name: preset.name } : agent;
  });
}

// -- Exports ------------------------------------------------------------------

export { withDefaultAgentNames };
