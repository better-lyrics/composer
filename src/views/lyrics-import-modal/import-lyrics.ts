import { useMemo } from "react";
import { toast } from "sonner";
import { isSupportedLyricsFile, UNSUPPORTED_LYRICS_FILE_MESSAGE } from "@/domain/lyrics-file/supported-formats";
import type { LyricsSearchResult } from "@/domain/lyrics-search/result";
import { filledMetadata } from "@/domain/project/imported-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { useAudioStore } from "@/stores/audio";
import { type ConfirmOptions, useConfirm } from "@/stores/confirm-store";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { extractBackgroundVocals } from "@/utils/background-vocal-extraction";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import {
  type ParseIssue,
  type ParseResult,
  skippedLineCount,
  skippedLinesMessage,
} from "@/utils/lyrics-parsers/shared";
import { distributeLinesTiming } from "@/views/timeline/utils";
import { pluralize } from "@/utils/pluralize";

// -- Types --------------------------------------------------------------------

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

interface ImportSourceInfo {
  label: string;
  filename: string;
}

interface ImportContext {
  confirm: ConfirmFn;
  audioDuration: number;
  applyBackgroundExtraction: boolean;
  backgroundExtractionMergeStandalone: boolean;
  backgroundExtractionPreserveBrackets: boolean;
  sourceLabel: string;
  onResult?: (parsed: ParseResult, source: ImportSourceInfo) => void;
}

interface ImportLyricsInput {
  filename: string;
  content: string;
  searchResult?: LyricsSearchResult;
}

// -- Copy ---------------------------------------------------------------------

function noLyricsMessage(filename: string, issues: ParseIssue[]): string {
  if (issues.some((issue) => issue.reason === "empty-document")) return `Could not read ${filename}.`;
  const skipped = skippedLineCount(issues);
  if (skipped === 0) return `No lyrics found in ${filename}.`;
  return `No lyrics could be read from ${filename}. ${skippedLinesMessage(skipped)}`;
}

function partialImportMessage(imported: number, skipped: number): string {
  return `Imported ${pluralize(imported, "line")}. ${skippedLinesMessage(skipped)}`;
}

// -- Helpers ------------------------------------------------------------------

function confirmReplace(confirm: ConfirmFn): Promise<boolean> {
  const existing = useProjectStore.getState().lines.length;
  if (existing === 0) return Promise.resolve(true);
  return confirm({
    title: "Replace existing lyrics?",
    description: `This replaces your ${pluralize(existing, "existing line")}.`,
    confirmLabel: "Replace",
    variant: "destructive",
    settingsKey: "confirmReplaceLyrics",
    recoverable: true,
  });
}

function searchResultMetadata(result: LyricsSearchResult | undefined): Partial<ProjectMetadata> {
  if (!result) return {};
  return {
    ...(result.track ? { title: result.track } : {}),
    ...(result.artist ? { artists: [result.artist] } : {}),
    ...(result.album ? { album: result.album } : {}),
  };
}

// -- Action -------------------------------------------------------------------

async function importLyrics(input: ImportLyricsInput, ctx: ImportContext): Promise<boolean> {
  const parsed = parseLyricsFile(input.filename, input.content, ctx.audioDuration > 0 ? ctx.audioDuration : undefined);
  if (parsed.lines.length === 0) {
    toast.error(noLyricsMessage(input.filename, parsed.issues));
    return false;
  }

  if (!(await confirmReplace(ctx.confirm))) return false;

  let workingLines = ctx.applyBackgroundExtraction
    ? extractBackgroundVocals(parsed.lines, {
        mergeStandaloneLines: ctx.backgroundExtractionMergeStandalone,
        preserveBrackets: ctx.backgroundExtractionPreserveBrackets,
      })
    : parsed.lines;

  if (!parsed.hasTimingData && ctx.audioDuration > 0) {
    workingLines = distributeLinesTiming(workingLines, ctx.audioDuration);
  }

  useProjectStore.getState().replaceLyricsWithHistory({
    lines: workingLines,
    groups: parsed.groups ?? [],
    agents: parsed.agents,
    metadata: { ...searchResultMetadata(input.searchResult), ...filledMetadata(parsed.metadata) },
  });

  const skipped = skippedLineCount(parsed.issues);
  if (skipped > 0) toast.warning(partialImportMessage(workingLines.length, skipped));

  ctx.onResult?.(parsed, { label: input.searchResult?.sourceLabel ?? ctx.sourceLabel, filename: input.filename });
  return true;
}

async function importLyricsFile(file: File, ctx: ImportContext): Promise<boolean> {
  // accept= is only a dialog hint: an OS picker set to all files or a drop reaches here.
  if (!isSupportedLyricsFile(file.name)) {
    toast.error(UNSUPPORTED_LYRICS_FILE_MESSAGE);
    return false;
  }
  return importLyrics({ filename: file.name, content: await file.text() }, ctx);
}

// -- Hook ---------------------------------------------------------------------

function useImportContext(sourceLabel: string): ImportContext {
  const confirm = useConfirm();
  const audioDuration = useAudioStore((s) => s.duration);
  const applyBackgroundExtraction = useSettingsStore((s) => s.autoExtractBackgroundVocals);
  const backgroundExtractionMergeStandalone = useSettingsStore((s) => s.mergeStandaloneBackgroundLines);
  const backgroundExtractionPreserveBrackets = useSettingsStore((s) => s.preserveBracketsOnExtraction);

  return useMemo(
    () => ({
      confirm,
      audioDuration,
      applyBackgroundExtraction,
      backgroundExtractionMergeStandalone,
      backgroundExtractionPreserveBrackets,
      sourceLabel,
      onResult: (parsed, source) => useImportModalStore.getState().recordImportResult(parsed, source),
    }),
    [
      confirm,
      audioDuration,
      applyBackgroundExtraction,
      backgroundExtractionMergeStandalone,
      backgroundExtractionPreserveBrackets,
      sourceLabel,
    ],
  );
}

// -- Exports ------------------------------------------------------------------

export { importLyrics, importLyricsFile, useImportContext };
export type { ImportContext, ImportSourceInfo };
