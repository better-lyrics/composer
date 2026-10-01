import { hasLyricLines } from "@/domain/project/lyrics-presence";
import { type ProjectFileContents, isProjectFileName, parseProjectFileContents } from "@/lib/project-file-read";
import { importProjectContents, reportUnreadableProjectFile, restoreBundleContents } from "@/lib/project-import";
import { type ChoiceRequest, askChoice } from "@/stores/choice-store";
import { useProjectStore } from "@/stores/project";
import { detectFileType } from "@/utils/lyrics-parsers/detect";
import type { ParseResult } from "@/utils/lyrics-parsers/shared";
import { pluralize } from "@/utils/pluralize";
import { formatProjectCount } from "@/utils/project-count";
import { UNSUPPORTED_LYRICS_IMPORT_MESSAGE, isLyricsImportFileName } from "@/views/lyrics-import-modal/accepted-files";
import { type ImportContext, importLyrics, importProjectLyrics } from "@/views/lyrics-import-modal/import-lyrics";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

type ProjectFileUse = "use-lyrics" | "open-project" | "restore-backup";

// -- Constants ----------------------------------------------------------------

const PASTED_TEXT_NAME = "pasted text";
const LEADING_BOM = /^\uFEFF/;
const PASTED_PROJECT_NAME = "the pasted project";
const USE_PROJECT_LYRICS_LABEL = "Use its lyrics here";
const OPEN_PROJECT_LABEL = "Open as its own project";

// -- Reading ------------------------------------------------------------------

function readProjectFileText(text: string): ProjectFileContents | null {
  const body = text.replace(LEADING_BOM, "");
  if (!body.trimStart().startsWith("{")) return null;
  try {
    return parseProjectFileContents(body);
  } catch {
    return null;
  }
}

// -- Copy ---------------------------------------------------------------------

function choiceTitle(fileName: string | null, noun: string): string {
  return fileName ? `${fileName} is a ${noun}` : `You pasted a ${noun}`;
}

function projectFileChoice(contents: ProjectFileContents, fileName: string | null): ChoiceRequest<ProjectFileUse> {
  if (contents.kind === "bundle") {
    return {
      title: choiceTitle(fileName, "Composer backup"),
      body: `It holds ${formatProjectCount(contents.projects.length)}. Restoring adds them to your library and keeps this project open.`,
      options: [{ value: "restore-backup", label: "Restore backup", variant: "primary" }],
    };
  }
  const title = choiceTitle(fileName, "Composer project");
  if (!hasLyricLines(contents.project.lines)) {
    return {
      title,
      body: "It has no lyrics yet, so it can only open as its own project.",
      options: [{ value: "open-project", label: OPEN_PROJECT_LABEL, variant: "primary" }],
    };
  }
  const existing = useProjectStore.getState().lines.length;
  const replaceNote =
    existing > 0 ? ` Using its lyrics replaces your ${pluralize(existing, "existing line")}. You can undo that.` : "";
  return {
    title,
    body: `Use its lyrics, singers and song details in this project, or open it as its own project.${replaceNote}`,
    options: [
      { value: "open-project", label: OPEN_PROJECT_LABEL, variant: "secondary" },
      { value: "use-lyrics", label: USE_PROJECT_LYRICS_LABEL, variant: existing > 0 ? "destructive" : "primary" },
    ],
  };
}

// -- Actions ------------------------------------------------------------------

async function importProjectFileForLyrics(
  contents: ProjectFileContents,
  fileName: string | null,
  ctx: ImportContext,
): Promise<boolean> {
  if (contents.kind === "bundle" && contents.projects.length === 0) {
    return restoreBundleContents(contents.projects, contents.unreadable);
  }
  const choice = await askChoice(projectFileChoice(contents, fileName));
  if (choice === "cancel") return false;
  if (contents.kind === "bundle") return restoreBundleContents(contents.projects, contents.unreadable);
  if (choice === "use-lyrics") return importProjectLyrics(contents.project, fileName ?? PASTED_PROJECT_NAME, ctx);
  return (await importProjectContents(contents)) !== null;
}

async function importProjectNamedFile(fileName: string, text: string, ctx: ImportContext): Promise<boolean> {
  let contents: ProjectFileContents;
  try {
    contents = parseProjectFileContents(text);
  } catch (error) {
    if (detectFileType("", text) === "ttml") return importLyrics({ filename: fileName, content: text }, ctx);
    reportUnreadableProjectFile(error);
    return false;
  }
  return importProjectFileForLyrics(contents, fileName, ctx);
}

async function importLyricsFile(file: File, ctx: ImportContext): Promise<boolean> {
  // accept= is only a dialog hint: an OS picker set to all files or a drop reaches here.
  if (!isLyricsImportFileName(file.name)) {
    toast.error(UNSUPPORTED_LYRICS_IMPORT_MESSAGE);
    return false;
  }
  const text = await file.text();
  if (isProjectFileName(file.name)) return importProjectNamedFile(file.name, text, ctx);
  const contents = readProjectFileText(text);
  if (contents) return importProjectFileForLyrics(contents, file.name, ctx);
  return importLyrics({ filename: file.name, content: text }, ctx);
}

function importPastedLyrics(content: string, parsed: ParseResult, ctx: ImportContext): Promise<boolean> {
  return importLyrics({ filename: PASTED_TEXT_NAME, content, parsed }, ctx);
}

async function importLyricsText(text: string, ctx: ImportContext): Promise<boolean> {
  const contents = readProjectFileText(text);
  if (contents) return importProjectFileForLyrics(contents, null, ctx);
  return importLyrics({ filename: PASTED_TEXT_NAME, content: text }, ctx);
}

// -- Exports ------------------------------------------------------------------

export {
  OPEN_PROJECT_LABEL,
  USE_PROJECT_LYRICS_LABEL,
  importLyricsFile,
  importLyricsText,
  importPastedLyrics,
  importProjectFileForLyrics,
  readProjectFileText,
};
