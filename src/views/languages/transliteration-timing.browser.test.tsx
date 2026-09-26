import { getLanguageDisplayLine } from "@/domain/language/display";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { type AlignmentField, TransliterationAlignmentModal } from "@/views/languages/transliteration-alignment-modal";
import { TransliterationRow } from "@/views/timeline/timeline-preview-rows";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordTrack } from "@/views/timeline/word-track";
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
        await screen.getByRole("button", { name: "Alignment boundary 3", exact: true }).click();
        await screen.getByRole("button", { name: "Alignment boundary 2", exact: true }).click();
        expect(mappedLabels()).toEqual(["to-", "do"]);
      }
      await screen.getByRole("button", { name: "Save alignment" }).click();
      const saved = useProjectStore.getState().lines[0];
      expect(saved[field]).toEqual(words);
      expect(background ? saved.transliteration?.backgroundText : saved.transliteration?.text).toBe(reading);
      await screen.unmount();

      useTimelineStore.setState({ textVariant: "transliteration" });
      const display = getLanguageDisplayLine(saved, "transliteration");
      const track = await render(
        <>
          <WordTrack
            lineId={line.id}
            lineIndex={0}
            words={saved[field]!}
            color="#a3c9ff"
            trackType={background ? "bg" : "word"}
            duration={3}
            height={32}
            onUpdateWord={() => {}}
          />
          <TransliterationRow
            text={reading}
            words={saved[field]}
            wordTexts={background ? display.backgroundWordTexts : display.wordTexts}
            timing={{ begin: 1, end: 2 }}
            lineIndex={0}
            alignmentClass=""
            background={background}
          />
        </>,
        { dndContext: true },
      );
      const blocks = track.container.querySelectorAll("[data-word-block]");
      expect(blocks[0].textContent).toContain("to-");
      expect(blocks[1].textContent).toContain("do");
      const preview = track.container.querySelectorAll("[data-word-begin]");
      expect(Array.from(preview, (el) => el.textContent)).toEqual([importedWordEdge ? "to-  " : "to-", "do"]);
      expect(preview[0].getAttribute("data-word-begin")).toBe("1");
      expect(preview[0].getAttribute("data-word-end")).toBe("1.5");
    },
  );
});
