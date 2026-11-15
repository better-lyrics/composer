import type { Part } from "./part";
import { type DocPassthrough, isEmptyDocPassthrough } from "./passthrough";
import { agentsAfterImport } from "./agent-imported-agents";
import type { Agent } from "./agent";
import { placeholderAgentName } from "./agent-placeholder-name";
import type { LinkGroup } from "./group";
import type { LyricLine } from "./line";
import { changedMetadata } from "./project-imported-metadata";
import type { ProjectMetadata } from "./metadata";
import { isStructurallyEqual } from "./structural-equal";

// -- Types --------------------------------------------------------------------

interface KeptRoot {
  parts: readonly Part[];
  passthrough: DocPassthrough;
}

interface EditedLyrics {
  lines: LyricLine[];
  groups: LinkGroup[];
  agents: Agent[] | undefined;
  metadata: Partial<ProjectMetadata>;
  kept?: KeptRoot;
}

interface ProjectLyrics {
  lines: readonly LyricLine[];
  groups: readonly LinkGroup[];
  agents: readonly Agent[];
  metadata: ProjectMetadata;
  parts?: readonly Part[];
  passthrough?: DocPassthrough;
}

type ProjectPart = "lines" | "metadata" | "agents" | "groups";

interface EditedLyricsWrite {
  lines: LyricLine[];
  groups: LinkGroup[];
  agents: Agent[];
  metadata: Partial<ProjectMetadata>;
  kept?: KeptRoot;
}

// -- Helpers ------------------------------------------------------------------

function withUnnamedAgentsKept(current: readonly Agent[], incoming: Agent[] | undefined): Agent[] | undefined {
  const currentById = new Map(current.map((agent) => [agent.id, agent] as const));
  return incoming?.map((agent, position) => {
    const existing = currentById.get(agent.id);
    return existing && !existing.name && agent.name === placeholderAgentName(position)
      ? { ...agent, name: existing.name }
      : agent;
  });
}

// A file read again makes new part ids, so parts compare by what they hold.
function samePart(a: Part, b: Part): boolean {
  return isStructurallyEqual({ ...a, id: "" }, { ...b, id: "" });
}

function sameKeptRoot(current: ProjectLyrics, kept: KeptRoot): boolean {
  const parts = current.parts ?? [];
  const sameParts =
    parts.length === kept.parts.length && parts.every((part, index) => samePart(part, kept.parts[index]));
  const samePassthrough =
    isEmptyDocPassthrough(current.passthrough) && isEmptyDocPassthrough(kept.passthrough)
      ? true
      : isStructurallyEqual(current.passthrough, kept.passthrough);
  return sameParts && samePassthrough;
}

// -- Functions ----------------------------------------------------------------

function editedLyricsWrite(current: ProjectLyrics, edited: EditedLyrics): EditedLyricsWrite {
  const agents = withUnnamedAgentsKept(current.agents, edited.agents);
  const assignment = agentsAfterImport(current.agents, agents, edited.lines);
  return {
    lines: assignment.lines,
    groups: edited.groups,
    agents: assignment.agents,
    metadata: changedMetadata(current.metadata, edited.metadata),
    ...(edited.kept && !sameKeptRoot(current, edited.kept) && { kept: edited.kept }),
  };
}

function changedParts(current: ProjectLyrics, write: EditedLyricsWrite, timeToleranceSeconds = 0): ProjectPart[] {
  const sameTime =
    timeToleranceSeconds > 0 ? (a: number, b: number) => Math.abs(a - b) <= timeToleranceSeconds : undefined;
  const changes: [ProjectPart, boolean][] = [
    ["lines", !isStructurallyEqual(current.lines, write.lines, sameTime)],
    ["metadata", Object.keys(write.metadata).length > 0],
    ["agents", !isStructurallyEqual(current.agents, write.agents)],
    ["groups", !isStructurallyEqual(current.groups, write.groups)],
  ];
  return changes.flatMap(([part, changed]) => (changed ? [part] : []));
}

function changesProject(current: ProjectLyrics, write: EditedLyricsWrite): boolean {
  return write.kept !== undefined || changedParts(current, write).length > 0;
}

// -- Exports ------------------------------------------------------------------

export type { EditedLyrics, ProjectLyrics, ProjectPart };
export { changedParts, changesProject, editedLyricsWrite };
