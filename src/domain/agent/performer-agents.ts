import type { Agent } from "@/domain/agent/model";

// -- Types --------------------------------------------------------------------

interface PerformerAgents {
  agentFor: (performers: readonly string[]) => Agent;
  agents: Agent[];
}

// -- Constants ----------------------------------------------------------------

const GROUP_AGENT_ID = "v1000";
const MIXED_GROUPS_NAME = "Chorus";
const GROUP_PERFORMER_NAMES = new Set(["合", "合唱", "all", MIXED_GROUPS_NAME.toLowerCase()]);

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

// A combination is keyed by its sorted case-folded members joined on a line break no name can
// contain, so casing drift and a reordering resolve to the same singer. Every group sings as v1000,
// the id lyric renderers centre as "all vocals together"; it keeps the name of the song's only
// combination, and reads as the chorus once a second one appears.
function createPerformerAgents(): PerformerAgents {
  const agents: Agent[] = [];
  const byKey = new Map<string, Agent>();
  const groupKeys = new Set<string>();
  const agentFor = (performers: readonly string[]): Agent => {
    const key = performers
      .map((performer) => performer.toLowerCase())
      .toSorted()
      .join("\n");
    if (performers.length > 1 || isGroupPerformerName(performers[0])) {
      groupKeys.add(key);
      const groupIndex = agents.findIndex((agent) => agent.id === GROUP_AGENT_ID);
      if (groupIndex === -1) {
        const group: Agent = { id: GROUP_AGENT_ID, type: "group", name: performers.join(", ") };
        agents.push(group);
        return group;
      }
      if (groupKeys.size > 1) agents[groupIndex] = { ...agents[groupIndex], name: MIXED_GROUPS_NAME };
      return agents[groupIndex];
    }
    const existing = byKey.get(key);
    if (existing) return existing;
    const person: Agent = {
      id: agentIdAt(agents.filter((agent) => agent.type === "person").length),
      type: "person",
      name: performers.join(", "),
    };
    agents.push(person);
    byKey.set(key, person);
    return person;
  };
  return { agentFor, agents };
}

// -- Exports ------------------------------------------------------------------

export { agentIdAt, createPerformerAgents, dedupeIgnoringCase, isGroupPerformerName };
