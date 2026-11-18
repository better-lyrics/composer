import { useMemo } from "react";
import type { ExtractOptions } from "insync/background-vocal-extraction";
import { type SettingsState, useSettingsStore } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

type ExtractionSettings = Pick<
  SettingsState,
  "mergeStandaloneBackgroundLines" | "preserveBracketsOnExtraction" | "backgroundSeparator"
>;

// -- Functions ----------------------------------------------------------------

function extractOptionsOf(settings: ExtractionSettings): ExtractOptions {
  return {
    mergeStandaloneLines: settings.mergeStandaloneBackgroundLines,
    preserveBrackets: settings.preserveBracketsOnExtraction,
    separator: settings.backgroundSeparator,
  };
}

function settingsExtractOptions(): ExtractOptions {
  return extractOptionsOf(useSettingsStore.getState());
}

// -- Hooks --------------------------------------------------------------------

function useExtractOptions(): ExtractOptions {
  const mergeStandaloneBackgroundLines = useSettingsStore((s) => s.mergeStandaloneBackgroundLines);
  const preserveBracketsOnExtraction = useSettingsStore((s) => s.preserveBracketsOnExtraction);
  const backgroundSeparator = useSettingsStore((s) => s.backgroundSeparator);
  return useMemo(
    () => extractOptionsOf({ mergeStandaloneBackgroundLines, preserveBracketsOnExtraction, backgroundSeparator }),
    [mergeStandaloneBackgroundLines, preserveBracketsOnExtraction, backgroundSeparator],
  );
}

// -- Exports ------------------------------------------------------------------

export { extractOptionsOf, settingsExtractOptions, useExtractOptions };
