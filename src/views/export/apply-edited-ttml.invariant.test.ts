import { useProjectStore } from "@/stores/project";
import { type EditCase, lineById } from "@/test/edited-ttml-edits";
import { LINE_IDENTITY_OPERATIONS } from "@/test/edited-ttml-identity-operations";
import { COMBINED_OPERATIONS, OPERATIONS } from "@/test/edited-ttml-operations";
import { EDITED_TTML_PROJECTS, type EditedTtmlProject } from "@/test/edited-ttml-projects";
import { generateProjectTtml } from "@/utils/ttml";
import { applyEditedTtml } from "@/views/export/apply-edited-ttml";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function keptOverProjectChange(editCase: EditCase, atEditStart: EditedTtmlProject, fixture: EditedTtmlProject) {
  const source = generateProjectTtml(useProjectStore.getState(), 0);
  useProjectStore.setState({ ttmlEditState: { source, content: editCase.edited } });
  const changed = editCase.projectChangeBeforeKeepingEdits?.(atEditStart.lines, fixture.lines) ?? atEditStart.lines;
  useProjectStore.setState({ lines: changed });
  const generated = generateProjectTtml(useProjectStore.getState(), 0);
  useProjectStore.setState({ ttmlEditState: { source: generated, content: editCase.edited, lyricsChanged: true } });
  return changed;
}

// -- Tests --------------------------------------------------------------------

describe("applyEditedTtml · invariants", () => {
  for (const fixture of EDITED_TTML_PROJECTS) {
    for (const operation of [...OPERATIONS, ...COMBINED_OPERATIONS, ...LINE_IDENTITY_OPERATIONS]) {
      it(`${fixture().name}: ${operation.name} changes only what the edit changed`, () => {
        const project = fixture();
        const atEditStart = operation.linesAtEditStart
          ? { ...project, lines: operation.linesAtEditStart(project) }
          : project;
        useProjectStore.setState({
          lines: atEditStart.lines,
          groups: project.groups,
          agents: project.agents,
          metadata: project.metadata,
        });
        const editCase = operation.edit(atEditStart, generateProjectTtml(useProjectStore.getState(), 0));
        if (editCase.projectChangeBeforeKeepingEdits) {
          const changed = keptOverProjectChange(editCase, atEditStart, project);
          expect(applyEditedTtml(editCase.edited, 0)).toEqual({ status: "export-only", reason: "lyrics-changed" });
          expect(useProjectStore.getState().lines).toBe(changed);
          return;
        }

        const result = applyEditedTtml(editCase.edited, 0);
        expect(result).toMatchObject({ status: "applied" });
        if (editCase.lossless) expect(result).toMatchObject({ keptInExport: false });

        const state = useProjectStore.getState();
        const skipped = new Set([...editCase.touched, ...(editCase.deleted ?? [])]);
        const untouched = project.lines.filter((line) => !skipped.has(line.id));
        for (const line of untouched) expect(lineById(state.lines, line.id)).toEqual(line);
        const ids = state.lines.map((line) => line.id);
        expect(new Set(ids).size).toBe(ids.length);
        if (!editCase.reordered) {
          const kept = new Set(project.lines.map((line) => line.id));
          expect(ids.filter((id) => kept.has(id))).toEqual(
            project.lines.flatMap((line) => (editCase.deleted?.includes(line.id) ? [] : [line.id])),
          );
        }
        expect(state.agents).toEqual(project.agents);
        expect(state.groups).toEqual(project.groups);
        editCase.expectTaken(state.lines);

        const settled = state.lines;
        const again = applyEditedTtml(generateProjectTtml(state, 0), 0);
        expect(again).toEqual({ status: "applied", skipped: 0, keptInExport: false });
        expect(useProjectStore.getState().lines).toBe(settled);
      });
    }
  }
});
