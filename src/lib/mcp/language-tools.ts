import { alignTrackToLine } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { wholeLineSegments } from "@/domain/language/manual-segments";
import type { TranslationTrack, TransliterationTrack } from "@/domain/language/model";
import { type LineUpdate, type LyricLine, reconcileLine } from "@/domain/line/model";
import {
  type LanguageLineArg,
  type ToolArgs,
  languageLines,
  optionalString,
  requiredString,
} from "@/domain/mcp/tool-args";
import type { WordTiming } from "@/domain/word/timing";
import { linesById, requireEditableLines, requireOpenProject } from "@/lib/mcp/tool-project";
import { useProjectStore } from "@/stores/project";

// -- Helpers ------------------------------------------------------------------

function prepare(args: ToolArgs): { input: LanguageLineArg[]; byId: Map<string, LyricLine> } {
  requireOpenProject(optionalString(args, "projectId"));
  const lines = requireEditableLines();
  const input = languageLines(args);
  return {
    input,
    byId: linesById(
      lines,
      input.map((line) => line.lineId),
    ),
  };
}

function lineFor(byId: Map<string, LyricLine>, id: string): LyricLine {
  const line = byId.get(id);
  if (!line) throw new Error(`line ${id} vanished after validation`);
  return line;
}

function mappedSyllables(
  words: WordTiming[] | undefined,
): Array<{ text: string; transliteration: string }> | undefined {
  return words?.map((word) => ({ text: word.text, transliteration: word.transliteration ?? "" }));
}

// A language-only write: never let it reshape the lyrics or reach linked sibling lines.
function commit(updates: LineUpdate[]): void {
  useProjectStore.getState().updateLinesWithHistory(updates, { deriveText: false, propagateToSiblings: false });
}

// -- Tools --------------------------------------------------------------------

function setTransliterations(args: ToolArgs): unknown {
  const { input, byId } = prepare(args);
  const requestedLanguage = optionalString(args, "language")?.trim();
  const songLanguage = useProjectStore.getState().metadata.language;
  const updates: LineUpdate[] = [];
  const results = input.map(({ lineId, text, backgroundText }) => {
    const line = lineFor(byId, lineId);
    const existing = line.transliteration;
    const main = text.trim();
    const background = (backgroundText ?? existing?.backgroundText ?? "").trim();
    const track: TransliterationTrack = {
      language: requestedLanguage || existing?.language || `${songLanguage || "und"}-Latn`,
      text: main,
      segments: wholeLineSegments(line.text, main),
      ...(background
        ? { backgroundText: background, backgroundSegments: wholeLineSegments(line.backgroundText ?? "", background) }
        : {}),
      origin: "import",
      sourceFingerprint: languageSourceFingerprint(line.text, line.backgroundText),
    };
    const aligned = alignTrackToLine(line, track);
    const lineUpdates = main || background ? aligned : { ...aligned, transliteration: undefined };
    updates.push({ id: lineId, updates: lineUpdates });
    const next = reconcileLine({ ...line, ...lineUpdates });
    return {
      lineId,
      alignment: next.transliteration?.alignmentStatus ?? null,
      syllables: mappedSyllables(next.words),
      ...(background
        ? {
            backgroundAlignment: next.transliteration?.backgroundAlignmentStatus ?? null,
            backgroundSyllables: mappedSyllables(next.backgroundWords),
          }
        : {}),
    };
  });
  commit(updates);
  return { saved: results.length, lines: results };
}

function setTranslations(args: ToolArgs): unknown {
  const { input, byId } = prepare(args);
  const language = requiredString(args, "language").trim();
  const updates: LineUpdate[] = input.map(({ lineId, text, backgroundText }) => {
    const line = lineFor(byId, lineId);
    const { [language]: existing, ...others } = line.translations ?? {};
    const main = text.trim();
    const background = (backgroundText ?? existing?.backgroundText ?? "").trim();
    if (!main && !background) return { id: lineId, updates: { translations: others } };
    const track: TranslationTrack = {
      language,
      text: main,
      ...(background ? { backgroundText: background } : {}),
      origin: "import",
      sourceFingerprint: languageSourceFingerprint(line.text, line.backgroundText),
    };
    return { id: lineId, updates: { translations: { ...others, [language]: track } } };
  });
  commit(updates);
  return { saved: updates.length, language };
}

// -- Exports ------------------------------------------------------------------

export { mappedSyllables, setTranslations, setTransliterations };
