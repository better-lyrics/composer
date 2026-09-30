import type { LyricLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { isLineTimed } from "@/domain/line/sync-progress";
import { useProjectStore } from "@/stores/project";
import { EDITED_TTML_PROJECTS, type EditedTtmlProject } from "@/test/edited-ttml-projects";
import { formatTime } from "@/utils/format-time";
import { generateProjectTtml } from "@/utils/ttml";
import { applyEditedTtml } from "@/views/export/apply-edited-ttml";
import { describe, expect, it } from "vitest";

// -- Types --------------------------------------------------------------------

interface EditCase {
  edited: string;
  touched: readonly string[];
  deleted?: readonly string[];
  reordered?: boolean;
  expectTaken: (lines: readonly LyricLine[]) => void;
}

interface EditOperation {
  name: string;
  edit: (project: EditedTtmlProject, ttml: string) => EditCase;
}

// -- Helpers ------------------------------------------------------------------

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`fixture has no ${what}`);
  return value;
}

function keyOf(project: EditedTtmlProject, line: LyricLine): string {
  return `L${project.lines.filter(isLineTimed).indexOf(line) + 1}`;
}

function paragraphOf(ttml: string, project: EditedTtmlProject, line: LyricLine): string {
  const paragraph = new RegExp(`<p [^>]*itunes:key="${keyOf(project, line)}"[^>]*>[\\s\\S]*?</p>`);
  return required(ttml.match(paragraph)?.[0], `paragraph for ${line.id}`);
}

function editParagraph(ttml: string, project: EditedTtmlProject, line: LyricLine, change: (p: string) => string) {
  const paragraph = paragraphOf(ttml, project, line);
  const changed = change(paragraph);
  if (changed === paragraph) throw new Error(`edit did not change ${line.id}`);
  return ttml.replace(paragraph, changed);
}

function lineById(lines: readonly LyricLine[], id: string): LyricLine {
  return required(
    lines.find((line) => line.id === id),
    `line ${id}`,
  );
}

function timedAt(project: EditedTtmlProject, index: number): LyricLine {
  return required(project.lines.filter(isLineTimed)[index], `timed line ${index}`);
}

// -- Operations ---------------------------------------------------------------

const ADDED_LINE =
  '<p begin="0:30.000" end="0:31.000" ttm:agent="v1">Brand new line<span ttm:role="x-bg"><span begin="0:30.000" end="0:31.000">new ooh</span></span></p>';

const OPERATIONS: readonly EditOperation[] = [
  {
    name: "change a word's text",
    edit: (project, ttml) => {
      const line = required(project.lines.find(isWordSynced), "word-synced line");
      const words = line.words ?? [];
      const first = required(words[0], "word").text.trim();
      return {
        edited: editParagraph(ttml, project, line, (p) => p.replace(`>${first}</span>`, `>${first}X</span>`)),
        touched: [line.id],
        expectTaken: (lines) => {
          const after = lineById(lines, line.id).words ?? [];
          expect(after[0]?.text.trim()).toBe(`${first}X`);
          expect(after.slice(1)).toEqual(words.slice(1));
        },
      };
    },
  },
  {
    name: "change a line's timing",
    edit: (project, ttml) => {
      const line = required(project.lines.find(isLineSynced), "line-synced line");
      const end = required(line.end, "line end");
      const change = (p: string) => {
        const openTag = p.slice(0, p.indexOf(">") + 1);
        return p.replace(openTag, openTag.replace(`end="${formatTime(end)}"`, `end="${formatTime(end + 0.25)}"`));
      };
      return {
        edited: editParagraph(ttml, project, line, change),
        touched: [line.id],
        expectTaken: (lines) => expect(lineById(lines, line.id).end).toBeCloseTo(end + 0.25, 3),
      };
    },
  },
  {
    name: "add a line with a background",
    edit: (_project, ttml) => ({
      edited: ttml.replace("</div>", `${ADDED_LINE}</div>`),
      touched: [],
      expectTaken: (lines) => {
        const added = required(
          lines.find((line) => line.text === "Brand new line"),
          "added line",
        );
        expect(added).toMatchObject({ begin: 30, end: 31, backgroundText: "new ooh" });
        expect(added.backgroundWords).toBeUndefined();
      },
    }),
  },
  {
    name: "delete a line",
    edit: (project, ttml) => {
      const line = timedAt(project, 1);
      return {
        edited: ttml.replace(paragraphOf(ttml, project, line), ""),
        touched: [],
        deleted: [line.id],
        expectTaken: (lines) => expect(lines.some((candidate) => candidate.id === line.id)).toBe(false),
      };
    },
  },
  {
    name: "reorder two lines",
    edit: (project, ttml) => {
      const first = timedAt(project, 1);
      const second = timedAt(project, 2);
      const a = paragraphOf(ttml, project, first);
      const b = paragraphOf(ttml, project, second);
      return {
        edited: ttml.replace(a, "\u0000").replace(b, a).replace("\u0000", b),
        touched: [],
        reordered: true,
        expectTaken: (lines) => {
          const order = lines.filter(isLineTimed).map((line) => line.id);
          expect(order.indexOf(second.id)).toBe(order.indexOf(first.id) - 1);
        },
      };
    },
  },
  {
    name: "edit a translation",
    edit: (project, ttml) => {
      const line = required(
        project.lines.find((candidate) => Object.values(candidate.translations ?? {}).some((track) => track.text)),
        "translated line",
      );
      const [language, track] = required(
        Object.entries(line.translations ?? {}).find(([, candidate]) => candidate.text),
        "translation",
      );
      const text = `<text for="${keyOf(project, line)}">${track.text}`;
      if (!ttml.includes(text)) throw new Error("translation not exported");
      return {
        edited: ttml.replace(text, `${text} again`),
        touched: [line.id],
        expectTaken: (lines) =>
          expect(lineById(lines, line.id).translations?.[language]?.text).toBe(`${track.text} again`),
      };
    },
  },
  {
    name: "edit a background",
    edit: (project, ttml) => {
      const line = required(
        project.lines.find((candidate) => candidate.backgroundText),
        "background",
      );
      const last = line.backgroundWords?.at(-1)?.text.trimEnd() ?? line.backgroundText;
      return {
        edited: editParagraph(ttml, project, line, (p) =>
          p.replace(`>${last}</span></span>`, `>${last}h</span></span>`),
        ),
        touched: [line.id],
        expectTaken: (lines) => expect(lineById(lines, line.id).backgroundText).toBe(`${line.backgroundText}h`),
      };
    },
  },
  {
    name: "edit the title",
    edit: (project, ttml) => ({
      edited: ttml.replace(`<ttm:title>${project.metadata.title}<`, `<ttm:title>${project.metadata.title} (Live)<`),
      touched: [],
      expectTaken: () => expect(useProjectStore.getState().metadata.title).toBe(`${project.metadata.title} (Live)`),
    }),
  },
];

// -- Tests --------------------------------------------------------------------

describe("applyEditedTtml · invariants", () => {
  for (const fixture of EDITED_TTML_PROJECTS) {
    for (const operation of OPERATIONS) {
      it(`${fixture().name}: ${operation.name} changes only what the edit changed`, () => {
        const project = fixture();
        useProjectStore.setState({
          lines: project.lines,
          groups: project.groups,
          agents: project.agents,
          metadata: project.metadata,
        });
        const editCase = operation.edit(project, generateProjectTtml(useProjectStore.getState(), 0));

        expect(applyEditedTtml(editCase.edited, 0)).toMatchObject({ status: "applied" });

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
