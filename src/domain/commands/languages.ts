import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand, patchLines } from "@/domain/commands/line-edits";
import { refused } from "@/domain/commands/outcome";
import { confirmTransliterationAlignment } from "@/domain/language/review";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

// -- Constants ----------------------------------------------------------------

// Language data never changes the text and stays on its own line.
const LANGUAGE_ONLY = { derivesText: false, propagateToSiblings: false } as const;
// Typed and confirmed language fields never reach the shared timing copy either.
const LANGUAGE_FIELD_EDIT = { ...LANGUAGE_ONLY, copiesSharedTiming: false } as const;

// -- Helpers ------------------------------------------------------------------

function languageUpdates(command: string, updates: readonly LineUpdate[]): LyricCommand {
  return lineEditCommand({ command, args: updates.map((update) => update.id) }, () => updates, LANGUAGE_ONLY);
}

// -- Commands -----------------------------------------------------------------

function setLanguageFields(lineId: string, fields: Partial<LyricLine>): LyricCommand {
  return lineEditCommand(
    { command: "set language fields", args: [lineId] },
    (root) =>
      root.lines.some((line) => line.id === lineId)
        ? [{ id: lineId, updates: fields }]
        : refused({ reason: "line-gone", lineId }),
    LANGUAGE_FIELD_EDIT,
  );
}

function saveTransliterationAlignment(
  lineId: string,
  field: "words" | "backgroundWords",
  words: WordTiming[],
): LyricCommand {
  return lineEditCommand(
    { command: "align transliteration", args: [lineId, field] },
    (root) => {
      const line = root.lines.find((candidate) => candidate.id === lineId);
      if (!line) return refused({ reason: "line-gone", lineId });
      return [
        { id: lineId, updates: { [field]: words, transliteration: confirmTransliterationAlignment(line, field) } },
      ];
    },
    LANGUAGE_FIELD_EDIT,
  );
}

function applyGeneratedLanguages(updates: readonly LineUpdate[]): LyricCommand {
  return languageUpdates("generate languages", updates);
}

function pasteLanguageLines(updates: readonly LineUpdate[]): LyricCommand {
  return languageUpdates("paste languages", updates);
}

function removeTranslation(language: string): LyricCommand {
  return lineEditCommand(
    { command: "remove translation", args: [language] },
    (root) =>
      root.lines.flatMap((line) => {
        if (!line.translations?.[language]) return [];
        const translations = { ...line.translations };
        delete translations[language];
        return [{ id: line.id, updates: { translations } }];
      }),
    LANGUAGE_ONLY,
  );
}

// Joins the step that changed the lyrics (mode "amend"), so it never copies shared timing or derives text.
function refreshGeneratedLanguages(updates: readonly LineUpdate[]): LyricCommand {
  return { ...patchLines(updates), note: { command: "refresh languages", args: updates.map((update) => update.id) } };
}

// -- Exports ------------------------------------------------------------------

export {
  applyGeneratedLanguages,
  pasteLanguageLines,
  refreshGeneratedLanguages,
  removeTranslation,
  saveTransliterationAlignment,
  setLanguageFields,
};
