import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { changedParts, changesProject, editedLyricsWrite } from "@/domain/project/edited-lyrics";
import { createGroup, createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function project() {
  return {
    lines: [createLine({ id: "a", text: "Hello", begin: 1, end: 2, agentId: DEFAULT_AGENTS[0]?.id ?? "v1" })],
    groups: [createGroup({ id: "g1" })],
    agents: DEFAULT_AGENTS,
    metadata: { title: "Song", artists: ["A"], album: "", duration: 0, language: "en-us" },
  };
}

function sameEdit(current: ReturnType<typeof project>) {
  return {
    lines: current.lines.map((line) => ({ ...line })),
    groups: current.groups.map((group) => ({ ...group })),
    agents: current.agents.map((agent) => ({ ...agent })),
    metadata: { title: "Song", artists: ["A"], language: "en-US" },
  };
}

// -- Tests --------------------------------------------------------------------

describe("editedLyricsWrite", () => {
  it("writes only the song details that changed", () => {
    const current = project();
    const write = editedLyricsWrite(current, { ...sameEdit(current), metadata: { title: "New", artists: ["A"] } });
    expect(write.metadata).toEqual({ title: "New" });
  });

  describe("regressions", () => {
    it("regression: keeps a singer without a name unnamed when the edit reads it with the placeholder name", () => {
      const current = { ...project(), agents: [{ id: "v1", type: "person" as const }] };
      const edit = { ...sameEdit(current), agents: [{ id: "v1", type: "person" as const, name: "Voice 1" }] };
      const write = editedLyricsWrite(current, edit);
      expect(write.agents[0]?.name).toBeUndefined();
      expect(changesProject(current, write)).toBe(false);
    });

    it("takes a real name the edit gives a singer without a name", () => {
      const current = { ...project(), agents: [{ id: "v1", type: "person" as const }] };
      const edit = { ...sameEdit(current), agents: [{ id: "v1", type: "person" as const, name: "Ana" }] };
      expect(editedLyricsWrite(current, edit).agents[0]?.name).toBe("Ana");
    });
  });

  it("keeps the stored agents when the edit declares none", () => {
    const current = project();
    expect(editedLyricsWrite(current, { ...sameEdit(current), agents: undefined }).agents).toEqual(DEFAULT_AGENTS);
  });
});

describe("changesProject", () => {
  it("sees an edit that repeats the project as no change", () => {
    const current = project();
    expect(changesProject(current, editedLyricsWrite(current, sameEdit(current)))).toBe(false);
  });

  describe("cross-field interactions", () => {
    it("sees a changed line", () => {
      const current = project();
      const edit = { ...sameEdit(current), lines: [{ ...current.lines[0], text: "Hi" }] };
      expect(changesProject(current, editedLyricsWrite(current, edit))).toBe(true);
    });

    it("sees a changed group", () => {
      const current = project();
      const edit = { ...sameEdit(current), groups: [createGroup({ id: "g1", label: "Chorus 2" })] };
      expect(changesProject(current, editedLyricsWrite(current, edit))).toBe(true);
    });

    it("sees a renamed agent", () => {
      const current = project();
      const edit = { ...sameEdit(current), agents: current.agents.map((agent) => ({ ...agent, name: "Renamed" })) };
      expect(changesProject(current, editedLyricsWrite(current, edit))).toBe(true);
    });

    it("sees a changed song detail", () => {
      const current = project();
      const edit = { ...sameEdit(current), metadata: { title: "Other" } };
      expect(changesProject(current, editedLyricsWrite(current, edit))).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("sees key order and unset keys as no change", () => {
      const current = project();
      const lines = current.lines.map(({ id, text, ...rest }) => ({ ...rest, text, id, detached: undefined }));
      const reordered = { ...sameEdit(current), lines };
      expect(changesProject(current, editedLyricsWrite(current, reordered))).toBe(false);
    });
  });
});

describe("changedParts", () => {
  it("names nothing for an edit that repeats the project", () => {
    const current = project();
    expect(changedParts(current, editedLyricsWrite(current, sameEdit(current)))).toEqual([]);
  });

  it("names every part the edit changes, lines first", () => {
    const current = project();
    const edit = {
      lines: [{ ...current.lines[0], text: "Hi" }],
      groups: [createGroup({ id: "g1", label: "Chorus 2" })],
      agents: current.agents.map((agent) => ({ ...agent, name: "Renamed" })),
      metadata: { title: "Other" },
    };
    expect(changedParts(current, editedLyricsWrite(current, edit))).toEqual(["lines", "metadata", "agents", "groups"]);
  });

  it("names only the song details when only they change", () => {
    const current = project();
    const edit = { ...sameEdit(current), metadata: { album: "New album" } };
    expect(changedParts(current, editedLyricsWrite(current, edit))).toEqual(["metadata"]);
  });
});
