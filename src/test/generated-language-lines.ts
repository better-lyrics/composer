import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";

// -- Helpers -----------------------------------------------------------------

// The provider caches answers by text for the session, so every test uses its own lyrics.
function timedLine(id: string, words: string[], romanized: string[], romanizedFrom = words.join(" ")): LyricLine {
  const sourceFingerprint = languageSourceFingerprint(romanizedFrom);
  return {
    id,
    agentId: "v1",
    text: words.join(" "),
    words: words.map((text, index) => ({
      text: index < words.length - 1 ? `${text} ` : text,
      begin: index + 1,
      end: index + 2,
      transliteration: romanized[index],
    })),
    transliteration: {
      language: "ru-Latn",
      text: romanized.join("  "),
      segments: [],
      origin: "google",
      sourceFingerprint,
      alignmentStatus: "confirmed",
    },
    translations: {
      en: { language: "en", text: "Old translation", origin: "google", sourceFingerprint },
    },
  };
}

function lineById(id: string): LyricLine {
  const line = useProjectStore.getState().lines.find((candidate) => candidate.id === id);
  if (!line) throw new Error(`Missing line ${id}`);
  return line;
}

function romanizedWords(id: string): Array<string | undefined> {
  return lineById(id).words?.map((word) => word.transliteration) ?? [];
}

// -- Exports ------------------------------------------------------------------

export { lineById, romanizedWords, timedLine };
