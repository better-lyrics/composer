import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { Agent } from "@/domain/agent/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import type { ConvertArgs } from "@/pages/converters/converter-view";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { generateTTML } from "@/utils/ttml";

// -- Types --------------------------------------------------------------------

interface ParserConversion {
  extension: string;
  granularity: "auto" | "line";
  emptyMessage: string;
  failureMessage: string;
  logLabel: string;
}

type ConversionResult = { ttml: string; projectPayload: string } | { error: string };

// -- Conversion ---------------------------------------------------------------

function convertViaParser(conversion: ParserConversion, { input, filename }: ConvertArgs): ConversionResult {
  try {
    const suffix = `.${conversion.extension}`;
    const result = parseLyricsFile(filename.endsWith(suffix) ? filename : `input${suffix}`, input);
    if (result.lines.length === 0) return { error: conversion.emptyMessage };

    // The converter page never reaches the project store, so this is the only
    // place the parsed songwriters, ISRC and extra fields can survive.
    const metadata: ProjectMetadata = { ...normalizeLoadedMetadata(result.metadata), duration: 0 };
    const agents: Agent[] = result.agents ?? DEFAULT_AGENTS;
    const granularity =
      conversion.granularity === "line" || !result.lines.some((line) => line.words?.length) ? "line" : "word";

    return {
      ttml: generateTTML({ metadata, agents, lines: result.lines, granularity }),
      projectPayload: JSON.stringify({ metadata, agents, lines: result.lines, granularity }),
    };
  } catch (conversionError) {
    console.error(`[Composer] ${conversion.logLabel} conversion failed`, conversionError);
    return { error: conversion.failureMessage };
  }
}

// -- Exports ------------------------------------------------------------------

export { convertViaParser };
export type { ConversionResult, ParserConversion };
