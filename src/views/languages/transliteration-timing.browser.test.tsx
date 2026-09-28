import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { generateTTML } from "@/utils/ttml";
import { type AlignmentField, TransliterationAlignmentModal } from "@/views/languages/transliteration-alignment-modal";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordTrack } from "@/views/timeline/word-track";
import { TTMLParser } from "@braccato/parsers";
import { describe, expect, it } from "vitest";

describe("visible transliteration dash timing", () => {
  it.each<{ field: AlignmentField; importedWordEdge: boolean }>([
    { field: "words", importedWordEdge: false },
    { field: "backgroundWords", importedWordEdge: false },
    { field: "words", importedWordEdge: true },
    { field: "backgroundWords", importedWordEdge: true },
  ])(
    "keeps the timing map, saved blocks, and preview consistent for $field (imported word edge: $importedWordEdge)",
    async ({ field, importedWordEdge }) => {
      const background = field === "backgroundWords";
      const original = importedWordEdge ? "to- do" : "to-do";
      const reading = importedWordEdge ? "to-  do" : "to-do";
      const words = [
        {
          text: importedWordEdge ? "to- " : "to-",
          begin: 1,
          end: 1.5,
          transliteration: importedWordEdge ? "to-" : "to",
          transliterationJoinerAfter: importedWordEdge ? "  " : "-",
        },
        { text: "do", begin: 1.5, end: 2, transliteration: "do" },
      ];
      const line: LyricLine = {
        id: "dash",
        agentId: "v1",
        text: background ? "Main" : original,
        ...(background ? { backgroundText: original } : {}),
        [field]: words,
        transliteration: {
          language: "en-Latn",
          text: background ? "" : reading,
          ...(background ? { backgroundText: reading } : {}),
          origin: "manual",
          segments: [],
          sourceFingerprint: languageSourceFingerprint(background ? "Main" : original),
        },
      };
      useProjectStore.getState().setLines([line]);
      const screen = await render(<TransliterationAlignmentModal line={line} field={field} onClose={() => {}} />);
      const mappedLabels = () =>
        Array.from(document.querySelectorAll('[aria-label="Timing map"] .font-medium'), (el) => el.textContent);
      expect(mappedLabels()).toEqual(importedWordEdge ? ["to-"] : ["to-", "do"]);

      // Boundaries on either side of a separator have the same visible timing ownership.
      if (!importedWordEdge) {
        await screen.getByRole("button", { name: "Transliteration split point 3", exact: true }).click();
        await screen.getByRole("button", { name: "Transliteration split point 2", exact: true }).click();
        expect(mappedLabels()).toEqual(["to-", "do"]);
      }
      await screen.getByRole("button", { name: "Save", exact: true }).click();
      const saved = useProjectStore.getState().lines[0];
      expect(saved[field]).toEqual(words);
      expect(background ? saved.transliteration?.backgroundText : saved.transliteration?.text).toBe(reading);
      await screen.unmount();

      useTimelineStore.setState({ textVariant: "transliteration" });
      const track = await render(
        <WordTrack
          lineId={line.id}
          lineIndex={0}
          words={saved[field]!}
          color="#a3c9ff"
          trackType={background ? "bg" : "word"}
          duration={3}
          height={32}
          onUpdateWord={() => {}}
        />,
        { dndContext: true },
      );
      const blocks = track.container.querySelectorAll("[data-word-block]");
      expect(blocks[0].textContent).toContain("to-");
      expect(blocks[1].textContent).toContain("do");
      // Export drops a line whose main text is untimed, so the background case needs a timed main word to reach the preview.
      const exported = background ? reconcileLine({ ...saved, words: [{ text: "Main", begin: 0, end: 1 }] }) : saved;
      const { metadata, agents } = useProjectStore.getState();
      const [previewLine] = TTMLParser.parse(generateTTML({ metadata, agents, lines: [exported], groups: [] }));
      const previewParts = (previewLine.timedRomanization ?? []).filter(
        (part) => Boolean(part.isBackground) === background,
      );
      expect(previewParts.map((part) => part.words)).toEqual(importedWordEdge ? ["to-", "  ", "do"] : ["to-", "do"]);
      expect(previewParts.map((part) => part.words).join("")).toBe(reading);
      expect(previewParts[0].startTimeMs).toBe(1000);
      expect(previewParts[0].durationMs).toBe(500);
    },
  );
});
