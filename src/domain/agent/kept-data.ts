import type { Agent } from "insync/agent";

// -- Functions ----------------------------------------------------------------

function agentWithoutKeptData(agent: Agent): Agent {
  if (!agent.passthrough && !agent.namePassthrough) return agent;
  const { passthrough: _passthrough, namePassthrough: _namePassthrough, ...own } = agent;
  return own;
}

// -- Exports ------------------------------------------------------------------

export { agentWithoutKeptData };
