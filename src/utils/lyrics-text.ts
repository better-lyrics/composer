import type { LyricLine } from "@/stores/project";
import { cleanPipes } from "@/utils/split-by-pipe";
import { stripPipes } from "@/utils/sync-helpers";

// -- Helpers ------------------------------------------------------------------

function textToLyricLines(text: string, defaultAgentId: string, existingLines: LyricLine[] = []): LyricLine[] {
  // Build a map of text -> line data for exact matching
  const textToLine = new Map<string, LyricLine>();
  for (const line of existingLines) {
    const key = stripPipes(line.text);
    if (!textToLine.has(key)) {
      textToLine.set(key, line);
    }
  }

  const usedExistingIds = new Set<string>();
  const newLines = text.split("\n").filter((line) => line.trim() !== "");

  return newLines.map((lineText, index) => {
    const trimmed = lineText.trim();

    // Clean pipe syntax (strip leading/trailing/consecutive pipes per token)
    const cleanedText = cleanPipes(trimmed);
    // Strip pipes entirely for matching against existing lines
    const matchText = stripPipes(cleanedText);

    // Try exact text match first (match against pipe-stripped text or original)
    const exactMatch = textToLine.get(matchText);
    if (exactMatch && !usedExistingIds.has(exactMatch.id)) {
      usedExistingIds.add(exactMatch.id);
      // If text has pipes, update the text and clear timing (structure changed)
      if (cleanedText.includes("|")) {
        return {
          ...exactMatch,
          text: cleanedText,
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
        text: cleanedText,
        agentId: positionMatch.agentId,
        backgroundText: positionMatch.backgroundText,
      };
    }

    // New line - use defaults
    return {
      id: crypto.randomUUID(),
      text: cleanedText,
      agentId: defaultAgentId,
    };
  });
}

// -- Exports ------------------------------------------------------------------

export { textToLyricLines };
