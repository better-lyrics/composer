import type { Agent } from "@/domain/agent/model";

// -- Types --------------------------------------------------------------------

interface PerformerAgents {
  agentFor: (performers: readonly string[]) => Agent;
  agents: Agent[];
}

// -- Constants ----------------------------------------------------------------

const GROUP_PERFORMER_NAMES = new Set(["合", "合唱", "all"]);
const FIRST_GROUP_ORDINAL = 1000;

// -- Helpers ------------------------------------------------------------------

function agentIdAt(index: number): string {
  return `v${index + 1}`;
}

function isGroupPerformerName(name: string): boolean {
  return GROUP_PERFORMER_NAMES.has(name.toLowerCase());
}

function dedupeIgnoringCase(names: readonly string[]): string[] {
  const byFoldedName = new Map<string, string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (!byFoldedName.has(key)) byFoldedName.set(key, name);
  }
  return [...byFoldedName.values()];
}

// -- Roster -------------------------------------------------------------------

// A line carries one agent id, so a combination is an agent of its own, keyed by its sorted
// case-folded members joined on the slash no member can contain: casing drift and a reordering
// both resolve to one agent, while the display name keeps the order the document first wrote.
// Groups take ids from v1000, the TTML convention for lines sung together.
function createPerformerAgents(): PerformerAgents {
  const agents: Agent[] = [];
  const byKey = new Map<string, Agent>();
  const agentFor = (performers: readonly string[]): Agent => {
    const key = performers
      .map((performer) => performer.toLowerCase())
      .toSorted()
      .join("/");
    const existing = byKey.get(key);
    if (existing) return existing;
    const isGroup = performers.length > 1 || isGroupPerformerName(performers[0]);
    const sameKind = agents.filter((agent) => (agent.type === "group") === isGroup).length;
    const agent: Agent = {
      id: isGroup ? `v${FIRST_GROUP_ORDINAL + sameKind}` : agentIdAt(sameKind),
      type: isGroup ? "group" : "person",
      name: performers.join(", "),
    };
    agents.push(agent);
    byKey.set(key, agent);
    return agent;
  };
  return { agentFor, agents };
}

// -- Exports ------------------------------------------------------------------

export { agentIdAt, createPerformerAgents, dedupeIgnoringCase, isGroupPerformerName };
