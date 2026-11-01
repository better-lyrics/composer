import { buildProjectBundle } from "@/lib/project-bundle";
import { type ProjectFile, projectFileFrom } from "@/lib/project-file";
import type { SavedProject } from "@/lib/saved-project";
import { createGroup, createLine } from "@/test/factories";
import { storedProject } from "@/test/projects";

// -- Fixtures -----------------------------------------------------------------

const PROJECT_FILE_NAME = "Lust for Life-2026-10-01.ttml-project.json";

function lustForLifeProject(overrides: Partial<SavedProject> = {}): ProjectFile {
  return projectFileFrom(
    "lust",
    storedProject({
      metadata: { title: "Lust for Life", artists: ["Lana Del Rey"], album: "Lust for Life", duration: 264 },
      agents: [
        { id: "v1", type: "person", name: "Lana" },
        { id: "v2", type: "person", name: "Abel" },
      ],
      lines: [
        createLine({ id: "lust-1", text: "Climb up the H of the Hollywood sign", begin: 12, end: 15 }),
        createLine({ id: "lust-2", text: "In these stolen moments", agentId: "v2", groupId: "chorus", instanceIdx: 0 }),
      ],
      groups: [createGroup({ id: "chorus", label: "Chorus" })],
      audioSource: { kind: "file", name: "lust-for-life.opus" },
      ...overrides,
    }),
  );
}

function projectFileText(overrides: Partial<SavedProject> = {}): string {
  return JSON.stringify(lustForLifeProject(overrides));
}

function projectFileNamed(name = PROJECT_FILE_NAME, overrides: Partial<SavedProject> = {}): File {
  return new File([projectFileText(overrides)], name, { type: "application/json" });
}

function backupText(titles: readonly string[]): string {
  const sources = titles.map((title, index) => ({
    id: `backup-${index}`,
    project: storedProject({
      metadata: { title, artists: [], album: "", duration: 0 },
      lines: [createLine({ text: `${title} line` })],
    }),
  }));
  return JSON.stringify(buildProjectBundle(sources, 1_759_300_000_000));
}

function backupFileNamed(name: string, titles: readonly string[]): File {
  return new File([backupText(titles)], name, { type: "application/json" });
}

// -- Exports ------------------------------------------------------------------

export { PROJECT_FILE_NAME, backupFileNamed, backupText, projectFileNamed, projectFileText };
