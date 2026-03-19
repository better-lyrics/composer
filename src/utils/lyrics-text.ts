import type { LyricLine } from "@/stores/project";
import { splitWordsByPipe } from "@/utils/split-by-pipe";

// -- Helpers ------------------------------------------------------------------

function textToLyricLines(text: string, defaultAgentId: string, existingLines: LyricLine[] = []): LyricLine[] {
  // Build a map of text -> line data for exact matching
  const textToLine = new Map<string, LyricLine>();
  for (const line of existingLines) {
    // Only use first occurrence to handle duplicates
    if (!textToLine.has(line.text)) {
      textToLine.set(line.text, line);
    }
  }

  const usedExistingIds = new Set<string>();
  const newLines = text.split("\n").filter((line) => line.trim() !== "");

  return newLines.map((lineText, index) => {
    const trimmed = lineText.trim();

    // Apply pipe splitting to generate the display text (pipes removed, words split)
    const splitWords = splitWordsByPipe(trimmed);
    const displayText = splitWords.join("").trimEnd();

    // Try exact text match first (match against original or display text)
    const exactMatch = textToLine.get(trimmed) ?? textToLine.get(displayText);
    if (exactMatch && !usedExistingIds.has(exactMatch.id)) {
      usedExistingIds.add(exactMatch.id);
      // If text has pipes, update the text and clear timing (structure changed)
      if (trimmed.includes("|")) {
        return {
          ...exactMatch,
          text: displayText,
          words: undefined,
          begin: undefined,
          end: undefined,
        };
      }
      return { ...exactMatch };
    }

    // Try position-based match (for typo fixes) - preserve agent but not timing
    const positionMatch = existingLines[index];
    if (positionMatch && !usedExistingIds.has(positionMatch.id)) {
      usedExistingIds.add(positionMatch.id);
      return {
        id: crypto.randomUUID(),
        text: displayText,
        agentId: positionMatch.agentId,
        backgroundText: positionMatch.backgroundText,
      };
    }

    // New line - use defaults
    return {
      id: crypto.randomUUID(),
      text: displayText,
      agentId: defaultAgentId,
    };
  });
}

// -- Exports ------------------------------------------------------------------

export { textToLyricLines };
