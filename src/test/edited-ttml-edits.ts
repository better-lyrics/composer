import type { LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";
import type { EditedTtmlProject } from "@/test/edited-ttml-projects";
import { stripSplitCharacter } from "@/utils/split-character";
import { keyedExportLines } from "@/utils/ttml-line-keys";
import { expect } from "vitest";

// -- Types --------------------------------------------------------------------

interface EditCase {
  edited: string;
  touched: readonly string[];
  deleted?: readonly string[];
  reordered?: boolean;
  lossless?: boolean;
  projectChangeBeforeKeepingEdits?: (lines: LyricLine[], fixtureLines: LyricLine[]) => LyricLine[];
  expectTaken: (lines: readonly LyricLine[]) => void;
}

interface EditOperation {
  name: string;
  linesAtEditStart?: (project: EditedTtmlProject) => LyricLine[];
  edit: (project: EditedTtmlProject, ttml: string) => EditCase;
}

// -- Helpers ------------------------------------------------------------------

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`fixture has no ${what}`);
  return value;
}

function keyOf(project: EditedTtmlProject, line: LyricLine): string {
  return required(keyedExportLines(project.lines).find((keyed) => keyed.line === line)?.key, `key for ${line.id}`);
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
  return required(keyedExportLines(project.lines)[index]?.line, `exported line ${index}`);
}

function withoutElement(ttml: string, element: string): string {
  const at = ttml.indexOf(element);
  if (at < 0) return ttml;
  const lineStart = ttml.lastIndexOf("\n", at);
  return ttml.slice(0, lineStart) + ttml.slice(at + element.length);
}

function removeParagraph(ttml: string, project: EditedTtmlProject, line: LyricLine): string {
  const key = keyOf(project, line);
  const references = ttml.match(new RegExp(`<text for="${key}">[\\s\\S]*?</text>`, "g")) ?? [];
  return [paragraphOf(ttml, project, line), ...references].reduce(withoutElement, ttml);
}

function swapParagraphs(ttml: string, project: EditedTtmlProject, first: LyricLine, second: LyricLine): string {
  const a = paragraphOf(ttml, project, first);
  const b = paragraphOf(ttml, project, second);
  return ttml.replace(a, "\u0000").replace(b, a).replace("\u0000", b);
}

function editLineText(
  ttml: string,
  project: EditedTtmlProject,
  line: LyricLine,
): Pick<EditCase, "edited" | "expectTaken"> {
  const words = line.words ?? [];
  const expectStoredDataKept = (after: LyricLine) => {
    expect(after.translations).toEqual(line.translations);
    expect(after.transliteration?.origin).toBe(line.transliteration?.origin);
    expect(after.backgroundTextSource).toBe(line.backgroundTextSource);
  };
  if (isWordSynced(line)) {
    const first = required(words[0], "word").text.trim();
    return {
      edited: editParagraph(ttml, project, line, (p) => p.replace(`>${first}</span>`, `>${first}X</span>`)),
      expectTaken: (lines) => {
        const after = lineById(lines, line.id);
        expect(after.words?.[0]?.text.trim()).toBe(`${first}X`);
        expect(after.words?.slice(1)).toEqual(words.slice(1));
        expectStoredDataKept(after);
      },
    };
  }
  const text = stripSplitCharacter(line.text);
  return {
    edited: editParagraph(ttml, project, line, (p) => {
      const openTag = p.slice(0, p.indexOf(">") + 1);
      return p.replace(`${openTag}${text}`, `${openTag}${text}!`);
    }),
    expectTaken: (lines) => {
      const after = lineById(lines, line.id);
      expect(after.text).toBe(`${text}!`);
      expectStoredDataKept(after);
    },
  };
}

// -- Exports ------------------------------------------------------------------

export {
  editLineText,
  editParagraph,
  keyOf,
  lineById,
  paragraphOf,
  removeParagraph,
  required,
  swapParagraphs,
  timedAt,
};
export type { EditCase, EditOperation };
