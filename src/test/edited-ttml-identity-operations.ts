import type { LyricLine } from "@/domain/line/model";
import { isLineTimed } from "@/domain/line/sync-progress";
import {
  type EditOperation,
  editLineText,
  lineById,
  paragraphOf,
  removeParagraph,
  required,
  swapParagraphs,
} from "@/test/edited-ttml-edits";
import type { EditedTtmlProject } from "@/test/edited-ttml-projects";
import { stripSplitCharacter } from "@/utils/split-character";
import { expect } from "vitest";

// -- Helpers ------------------------------------------------------------------

function repeatedPair(project: EditedTtmlProject): [LyricLine, LyricLine] {
  const timed = project.lines.filter(isLineTimed);
  for (const [index, line] of timed.entries()) {
    const copy = timed
      .slice(index + 1)
      .find((other) => stripSplitCharacter(other.text) === stripSplitCharacter(line.text));
    if (copy) return [line, copy];
  }
  throw new Error("fixture has no repeated line");
}

function groupInstancePair(project: EditedTtmlProject): [LyricLine, LyricLine] {
  const timed = project.lines.filter(isLineTimed);
  for (const line of timed) {
    const other = timed.find(
      (candidate) => candidate.groupId === line.groupId && candidate.instanceIdx !== line.instanceIdx,
    );
    if (line.groupId && other) return [line, other];
  }
  throw new Error("fixture has no group with two instances");
}

// -- Operations ---------------------------------------------------------------

const LINE_IDENTITY_OPERATIONS: readonly EditOperation[] = [
  {
    name: "delete the second copy of a repeated line",
    edit: (project, ttml) => {
      const [first, copy] = repeatedPair(project);
      return {
        edited: removeParagraph(ttml, project, copy),
        touched: [],
        deleted: [copy.id],
        lossless: true,
        expectTaken: (lines) => expect(lineById(lines, first.id)).toEqual(first),
      };
    },
  },
  {
    name: "copy a translated paragraph to add a line",
    edit: (project, ttml) => {
      const line = required(
        project.lines.find((candidate) => Object.values(candidate.translations ?? {}).some((track) => track.text)),
        "translated line",
      );
      const original = paragraphOf(ttml, project, line);
      const text = stripSplitCharacter(line.text);
      const openTag = original.slice(0, original.indexOf(">") + 1);
      const copy = original.replace(`${openTag}${text}`, `${openTag}${text} again`);
      return {
        edited: ttml.replace(original, `${original}\n      ${copy}`),
        touched: [],
        expectTaken: (lines) => {
          const added = required(
            lines.find((candidate) => candidate.text === `${text} again`),
            "copied line",
          );
          expect(added.id).not.toBe(line.id);
          expect(added.translations).toBeUndefined();
          expect(lines.indexOf(added)).toBe(lines.indexOf(lineById(lines, line.id)) + 1);
        },
      };
    },
  },
  {
    name: "swap two group instances and edit one",
    edit: (project, ttml) => {
      const [first, second] = groupInstancePair(project);
      const textEdit = editLineText(ttml, project, first);
      return {
        edited: swapParagraphs(textEdit.edited, project, first, second),
        touched: [first.id],
        reordered: true,
        expectTaken: (lines) => {
          textEdit.expectTaken(lines);
          expect(lineById(lines, first.id)).toMatchObject({ groupId: first.groupId, instanceIdx: first.instanceIdx });
        },
      };
    },
  },
];

// -- Exports ------------------------------------------------------------------

export { LINE_IDENTITY_OPERATIONS };
