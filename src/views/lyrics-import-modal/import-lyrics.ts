import { hasAnyTiming } from "@/domain/line/predicates";
import type { LyricsSearchResult } from "@/domain/lyrics-search/result";
import { filledMetadata } from "@/domain/project/imported-metadata";
import { hasLyricLines } from "@/domain/project/lyrics-presence";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { ProjectFile } from "@/lib/project-file";
import { useAudioStore } from "@/stores/audio";
import { type ConfirmOptions, useConfirm } from "@/stores/confirm-store";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { extractBackgroundVocals } from "@/utils/background-vocal-extraction";
import { PARSERS, parseLyricsFile } from "@/utils/lyrics-parsers";
import {
  type ParseIssue,
  type ParseResult,
  skippedLineCount,
  skippedLinesMessage,
} from "@/utils/lyrics-parsers/shared";
import { pluralize } from "@/utils/pluralize";
import { distributeLinesTiming } from "@/views/timeline/utils";
import { useMemo } from "react";
import { toast } from "sonner";

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

type TtmlLyricsRead = { status: "readable"; parsed: ParseResult } | { status: "unreadable"; message: string };

interface ImportLyricsInput {
  filename: string;
  content: string;
  searchResult?: LyricsSearchResult;
  parsed?: ParseResult;
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
  const parsed =
    input.parsed ??
    parseLyricsFile(input.filename, input.content, ctx.audioDuration > 0 ? ctx.audioDuration : undefined);
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

function readTtmlLyrics(content: string, sourceName: string, audioDuration: number): TtmlLyricsRead {
  const parsed = PARSERS.ttml(content, audioDuration > 0 ? audioDuration : undefined);
  if (parsed.lines.length === 0) return { status: "unreadable", message: noLyricsMessage(sourceName, parsed.issues) };
  return { status: "readable", parsed };
}

function replaceWithTtmlLyrics(parsed: ParseResult): number {
  useProjectStore.getState().replaceLyricsWithHistory({
    lines: parsed.lines,
    groups: parsed.groups ?? [],
    agents: parsed.agents,
    metadata: filledMetadata(parsed.metadata),
  });
  return skippedLineCount(parsed.issues);
}

function importProjectLyrics(project: ProjectFile, filename: string, ctx: ImportContext): boolean {
  if (!hasLyricLines(project.lines)) {
    toast.error(noLyricsMessage(filename, []));
    return false;
  }
  const groups = project.groups ?? [];
  const metadata = filledMetadata(project.metadata);
  useProjectStore
    .getState()
    .replaceLyricsWithHistory({ lines: project.lines, groups, agents: project.agents, metadata });
  const parsed: ParseResult = {
    lines: project.lines,
    metadata,
    hasTimingData: project.lines.some(hasAnyTiming),
    issues: [],
    agents: project.agents,
    groups,
  };
  ctx.onResult?.(parsed, { label: ctx.sourceLabel, filename });
  return true;
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

export { importLyrics, importProjectLyrics, readTtmlLyrics, replaceWithTtmlLyrics, useImportContext };
export type { ImportContext, ImportSourceInfo };
