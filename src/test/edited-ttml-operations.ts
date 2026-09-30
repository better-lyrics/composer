import type { LyricLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { isLineTimed } from "@/domain/line/sync-progress";
import { timingGranularityOf } from "@/domain/project/timing-granularity";
import { useProjectStore } from "@/stores/project";
import {
  type EditOperation,
  editLineText,
  editParagraph,
  keyOf,
  lineById,
  paragraphOf,
  removeParagraph,
  required,
  swapParagraphs,
  timedAt,
} from "@/test/edited-ttml-edits";
import type { EditedTtmlProject } from "@/test/edited-ttml-projects";
import { formatTime } from "@/utils/format-time";
import { expect } from "vitest";

// -- Operations ---------------------------------------------------------------

function keepsTimingGranularity(project: EditedTtmlProject, deleted: LyricLine): boolean {
  const rest = project.lines.filter((line) => line !== deleted);
  return timingGranularityOf(rest) === timingGranularityOf(project.lines);
}

const ADDED_LINE =
  '<p begin="0:30.000" end="0:31.000" ttm:agent="v1">Brand new line<span ttm:role="x-bg"><span begin="0:30.000" end="0:31.000">new ooh</span></span></p>';

const OPERATIONS: readonly EditOperation[] = [
  {
    name: "change a word's text",
    edit: (project, ttml) => {
      const line = required(project.lines.find(isWordSynced), "word-synced line");
      return { ...editLineText(ttml, project, line), touched: [line.id] };
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
      edited: ttml.replace("\n    </div>", `\n      ${ADDED_LINE}\n    </div>`),
      touched: [],
      lossless: true,
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
        edited: removeParagraph(ttml, project, line),
        touched: [],
        deleted: [line.id],
        lossless: keepsTimingGranularity(project, line),
        expectTaken: (lines) => expect(lines.some((candidate) => candidate.id === line.id)).toBe(false),
      };
    },
  },
  {
    name: "reorder two lines",
    edit: (project, ttml) => {
      const first = timedAt(project, 1);
      const second = timedAt(project, 2);
      return {
        edited: swapParagraphs(ttml, project, first, second),
        touched: [],
        reordered: true,
        lossless: true,
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

const COMBINED_OPERATIONS: readonly EditOperation[] = [
  {
    name: "delete a line and edit its neighbour",
    edit: (project, ttml) => {
      const deleted = timedAt(project, 1);
      const line = timedAt(project, 2);
      const textEdit = editLineText(ttml, project, line);
      return {
        edited: textEdit.edited.replace(paragraphOf(ttml, project, deleted), ""),
        touched: [line.id],
        deleted: [deleted.id],
        expectTaken: textEdit.expectTaken,
      };
    },
  },
  {
    name: "add a line before an edited line",
    edit: (project, ttml) => {
      const line = timedAt(project, 1);
      const textEdit = editLineText(ttml, project, line);
      const edited = paragraphOf(textEdit.edited, project, line);
      return {
        edited: textEdit.edited.replace(edited, `${ADDED_LINE}${edited}`),
        touched: [line.id],
        expectTaken: (lines) => {
          textEdit.expectTaken(lines);
          const ids = lines.map((candidate) => candidate.id);
          expect(ids.indexOf(line.id)).toBe(lines.findIndex((candidate) => candidate.text === "Brand new line") + 1);
        },
      };
    },
  },
  {
    name: "reorder two lines and edit one",
    edit: (project, ttml) => {
      const first = timedAt(project, 1);
      const second = timedAt(project, 2);
      const textEdit = editLineText(ttml, project, first);
      return {
        edited: swapParagraphs(textEdit.edited, project, first, second),
        touched: [first.id],
        reordered: true,
        expectTaken: (lines) => {
          textEdit.expectTaken(lines);
          const order = lines.filter(isLineTimed).map((line) => line.id);
          expect(order.indexOf(second.id)).toBe(order.indexOf(first.id) - 1);
        },
      };
    },
  },
];

// -- Exports ------------------------------------------------------------------

export { COMBINED_OPERATIONS, OPERATIONS };
