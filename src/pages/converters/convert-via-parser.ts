import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { Agent } from "@/domain/agent/model";
import { hasAnyTiming } from "@/domain/line/predicates";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { timingGranularityOf } from "@/domain/project/timing-granularity";
import type { ConvertArgs } from "@/pages/converters/converter-view";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import type { LyricsFileType } from "@/utils/lyrics-parsers/detect";
import { skippedLineCount } from "@/utils/lyrics-parsers/shared";

// -- Types --------------------------------------------------------------------

interface ParserConversion {
  extension: Exclude<LyricsFileType, "unknown">;
  granularity: "auto" | "line";
  emptyMessage: string;
  failureMessage: string;
  logLabel: string;
}

type ConversionResult = { output: string; projectPayload: string; skippedLines: number } | { error: string };

// -- Conversion ---------------------------------------------------------------

function convertViaParser(conversion: ParserConversion, { input, filename, format }: ConvertArgs): ConversionResult {
  try {
    const suffix = `.${conversion.extension}`;
    const result = parseLyricsFile(filename.endsWith(suffix) ? filename : `input${suffix}`, input);
    if (!result.lines.some(hasAnyTiming)) return { error: conversion.emptyMessage };

    // The converter page never reaches the project store, so this is the only
    // place the parsed songwriters, ISRC and extra fields can survive.
    const metadata: ProjectMetadata = { ...normalizeLoadedMetadata(result.metadata), duration: 0 };
    const agents: Agent[] = result.agents ?? DEFAULT_AGENTS;
    const granularity = conversion.granularity === "line" ? "line" : timingGranularityOf(result.lines);

    return {
      output: format.write({ metadata, agents, lines: result.lines }),
      projectPayload: JSON.stringify({ metadata, agents, lines: result.lines, granularity }),
      skippedLines: skippedLineCount(result.issues),
    };
  } catch (conversionError) {
    console.error(`[Composer] ${conversion.logLabel} conversion failed`, conversionError);
    return { error: conversion.failureMessage };
  }
}

// -- Exports ------------------------------------------------------------------

export { convertViaParser };
export type { ConversionResult, ParserConversion };
