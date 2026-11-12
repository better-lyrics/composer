import { useMemo } from "react";
import { detectNonLatinLanguage } from "@/domain/language/script-detection";
import { withSeededBackground } from "@/domain/line/background";
import type { RawLine } from "@/domain/line/model";
import { hasAnyTiming } from "@/domain/line/predicates";
import type { LyricsSearchResult } from "@/domain/lyrics-search/result";
import { importableMetadata } from "@/domain/project/imported-metadata";
import { hasLyricLines } from "@/domain/project/lyrics-presence";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { noteGuideSignal } from "@/lib/guide-signals";
import type { ProjectFile } from "@/lib/project-file";
import { useAudioStore } from "@/stores/audio";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { type SettingsState, useSettingsStore } from "@/stores/settings";
import { extractBackgroundVocals } from "@/utils/background-vocal-extraction";
import { PARSERS, parseLyricsFile } from "@/utils/lyrics-parsers";
import {
  hasUnsupportedTags,
  type ParseIssue,
  type ParseResult,
  skippedLineCount,
  skippedLinesMessage,
  UNSUPPORTED_LRC_TAGS_MESSAGE,
} from "@/utils/lyrics-parsers/shared";
import { pluralize } from "@/utils/pluralize";
import { toast } from "@/utils/toast";
import { showUndoToast } from "@/utils/undo-toast";
import { distributeLinesTiming } from "@/views/timeline/utils";

// -- Types --------------------------------------------------------------------

interface ImportSourceInfo {
  label: string;
  filename: string;
}

interface ImportContext {
  audioDuration: number;
  applyBackgroundExtraction: boolean;
  backgroundExtractionMergeStandalone: boolean;
  backgroundExtractionPreserveBrackets: boolean;
  sourceLabel: string;
  onResult?: (parsed: ParseResult, source: ImportSourceInfo) => void;
}

type LyricsRead = { status: "readable"; parsed: ParseResult } | { status: "unreadable"; message: string };

interface ImportLyricsInput {
  filename: string;
  content: string;
  searchResult?: LyricsSearchResult;
  parsed?: ParseResult;
}

// -- Copy ---------------------------------------------------------------------

function noLyricsMessage(filename: string, issues: ParseIssue[]): string {
  if (issues.some((issue) => issue.reason === "empty-document")) return `Could not read ${filename}.`;
  if (hasUnsupportedTags(issues)) return `Could not import ${filename}. ${UNSUPPORTED_LRC_TAGS_MESSAGE}`;
  const skipped = skippedLineCount(issues);
  if (skipped === 0) return `No lyrics found in ${filename}.`;
  return `No lyrics could be read from ${filename}. ${skippedLinesMessage(skipped)}`;
}

function partialImportMessage(imported: number, skipped: number): string {
  return `Imported ${pluralize(imported, "line")}. ${skippedLinesMessage(skipped)}`;
}

// -- Helpers ------------------------------------------------------------------

function searchResultMetadata(result: LyricsSearchResult | undefined): Partial<ProjectMetadata> {
  if (!result) return {};
  return {
    ...(result.track ? { title: result.track } : {}),
    ...(result.artist ? { artists: [result.artist] } : {}),
    ...(result.album ? { album: result.album } : {}),
  };
}

function replaceLyrics(
  parsed: ParseResult,
  lines: RawLine[] = parsed.lines,
  fallbackMetadata: Partial<ProjectMetadata> = {},
): ParseResult {
  const metadata = importableMetadata(parsed.metadata);
  useProjectStore.getState().replaceLyricsWithHistory({
    lines,
    groups: parsed.groups ?? [],
    agents: parsed.agents,
    metadata: { ...fallbackMetadata, ...metadata },
  });
  if (parsed.madeInAmllTool) noteGuideSignal("import.amllFile");
  return { ...parsed, metadata };
}

// -- Action -------------------------------------------------------------------

function importLyrics(input: ImportLyricsInput, ctx: ImportContext): boolean {
  const parsed =
    input.parsed ??
    parseLyricsFile(input.filename, input.content, ctx.audioDuration > 0 ? ctx.audioDuration : undefined);
  if (parsed.lines.length === 0) {
    toast.error(noLyricsMessage(input.filename, parsed.issues));
    return false;
  }

  const replacesLines = useProjectStore.getState().lines.length > 0;

  let workingLines = ctx.applyBackgroundExtraction
    ? extractBackgroundVocals(parsed.lines, {
        mergeStandaloneLines: ctx.backgroundExtractionMergeStandalone,
        preserveBrackets: ctx.backgroundExtractionPreserveBrackets,
      })
    : parsed.lines;

  if (!parsed.hasTimingData && ctx.audioDuration > 0) {
    workingLines = distributeLinesTiming(workingLines, ctx.audioDuration).map(withSeededBackground);
  }

  const reported = replaceLyrics(parsed, workingLines, searchResultMetadata(input.searchResult));
  if (replacesLines) showUndoToast("Replaced the lyrics");

  const skipped = skippedLineCount(parsed.issues);
  if (skipped > 0) toast.warning(partialImportMessage(workingLines.length, skipped));

  if (input.searchResult) noteGuideSignal("edit.search");
  if (detectNonLatinLanguage(workingLines.map((line) => line.text).join("\n"))) noteGuideSignal("edit.nonLatinLyrics");
  ctx.onResult?.(reported, { label: input.searchResult?.sourceLabel ?? ctx.sourceLabel, filename: input.filename });
  return true;
}

function readParsedLyrics(parsed: ParseResult, sourceName: string): LyricsRead {
  if (parsed.lines.length === 0) return { status: "unreadable", message: noLyricsMessage(sourceName, parsed.issues) };
  return { status: "readable", parsed };
}

function readTtmlLyrics(content: string, sourceName: string, audioDuration: number): LyricsRead {
  return readParsedLyrics(PARSERS.ttml(content, audioDuration > 0 ? audioDuration : undefined), sourceName);
}

function readLyricsFile(fileName: string, content: string): LyricsRead {
  return readParsedLyrics(parseLyricsFile(fileName, content, undefined), fileName);
}

function replaceWithParsedLyrics(parsed: ParseResult): number {
  replaceLyrics(parsed);
  return skippedLineCount(parsed.issues);
}

function importProjectLyrics(project: ProjectFile, filename: string, ctx: ImportContext): boolean {
  if (!hasLyricLines(project.lines)) {
    toast.error(noLyricsMessage(filename, []));
    return false;
  }
  const reported = replaceLyrics({
    lines: project.lines,
    metadata: project.metadata,
    hasTimingData: project.lines.some(hasAnyTiming),
    issues: [],
    agents: project.agents,
    groups: project.groups ?? [],
  });
  ctx.onResult?.(reported, { label: ctx.sourceLabel, filename });
  return true;
}

// -- Context ------------------------------------------------------------------

type ExtractionSettings = Pick<
  SettingsState,
  "autoExtractBackgroundVocals" | "mergeStandaloneBackgroundLines" | "preserveBracketsOnExtraction"
>;

function buildImportContext(sourceLabel: string, audioDuration: number, settings: ExtractionSettings): ImportContext {
  return {
    audioDuration,
    applyBackgroundExtraction: settings.autoExtractBackgroundVocals,
    backgroundExtractionMergeStandalone: settings.mergeStandaloneBackgroundLines,
    backgroundExtractionPreserveBrackets: settings.preserveBracketsOnExtraction,
    sourceLabel,
    onResult: (parsed, source) => useImportModalStore.getState().recordImportResult(parsed, source),
  };
}

function currentImportContext(sourceLabel: string, audioDuration: number): ImportContext {
  return buildImportContext(sourceLabel, audioDuration, useSettingsStore.getState());
}

// -- Hook ---------------------------------------------------------------------

function useImportContext(sourceLabel: string): ImportContext {
  const audioDuration = useAudioStore((s) => s.duration);
  const autoExtractBackgroundVocals = useSettingsStore((s) => s.autoExtractBackgroundVocals);
  const mergeStandaloneBackgroundLines = useSettingsStore((s) => s.mergeStandaloneBackgroundLines);
  const preserveBracketsOnExtraction = useSettingsStore((s) => s.preserveBracketsOnExtraction);

  return useMemo(
    () =>
      buildImportContext(sourceLabel, audioDuration, {
        autoExtractBackgroundVocals,
        mergeStandaloneBackgroundLines,
        preserveBracketsOnExtraction,
      }),
    [
      audioDuration,
      autoExtractBackgroundVocals,
      mergeStandaloneBackgroundLines,
      preserveBracketsOnExtraction,
      sourceLabel,
    ],
  );
}

// -- Exports ------------------------------------------------------------------

export type { ImportContext, ImportSourceInfo, LyricsRead };
export {
  currentImportContext,
  importLyrics,
  importProjectLyrics,
  readLyricsFile,
  readTtmlLyrics,
  replaceWithParsedLyrics,
  useImportContext,
};
