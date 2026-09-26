import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { TransliterationAlignmentModal } from "@/views/languages/transliteration-alignment-modal";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

function setupLine({
  text = "가나",
  words = [
    { text: "가", begin: 0, end: 0.5 },
    { text: "나", begin: 0.5, end: 1 },
  ],
  language = "ko-Latn",
  transliterationText,
  withTransliteration = true,
}: {
  text?: string;
  words?: WordTiming[];
  language?: string;
  transliterationText?: string;
  withTransliteration?: boolean;
} = {}): LyricLine {
  const line: LyricLine = {
    id: "l1",
    agentId: "v1",
    text,
    words,
    ...(withTransliteration
      ? {
          transliteration: {
            language,
            text: transliterationText ?? "gana",
            segments: [],
            origin: "manual",
            sourceFingerprint: languageSourceFingerprint(text),
          },
        }
      : {}),
  };
  useProjectStore.getState().setLines([line]);
  return line;
}

// -- Tests --------------------------------------------------------------------

describe("TransliterationAlignmentModal", () => {
  describe("happy path", () => {
    it("renders the dialog with the word select and syllable chips", async () => {
      const line = setupLine();
      const screen = await render(<TransliterationAlignmentModal line={line} field="words" onClose={() => {}} />);
      await expect.element(screen.getByRole("dialog", { name: "Align timing" })).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Original word to align" })).toHaveTextContent("1. 가나");
      await expect.element(screen.getByText("0:00.000 - 0:00.500")).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Save", exact: true })).not.toBeDisabled();
    });

    it("saves the exact boundary text into word timings", async () => {
      const line = setupLine();
      const screen = await render(<TransliterationAlignmentModal line={line} field="words" onClose={() => {}} />);
      await screen.getByRole("button", { name: "Save", exact: true }).click();
      const saved = useProjectStore.getState().lines[0];
      expect(saved.words?.[0].transliteration).toBe("ga");
      expect(saved.words?.[1].transliteration).toBe("na");
      expect(saved.transliteration?.alignmentStatus).toBe("confirmed");
    });
  });

  describe("edge cases", () => {
    it("needs no split point for a single-syllable word", async () => {
      const line = setupLine({
        text: "가",
        words: [{ text: "가", begin: 0, end: 1 }],
        transliterationText: "ga",
      });
      const screen = await render(<TransliterationAlignmentModal line={line} field="words" onClose={() => {}} />);
      const save = screen.getByRole("button", { name: "Save", exact: true });
      await expect.element(save).toBeEnabled();
      await screen.getByRole("button", { name: "Transliteration split point 1" }).click();
      await expect.element(save).toBeDisabled();
      await expect.element(screen.getByText("Pick 0 split points (1 so far).")).toBeInTheDocument();
    });

    it("renders nothing without a transliteration track", async () => {
      const line = setupLine({ withTransliteration: false });
      const screen = await render(<TransliterationAlignmentModal line={line} field="words" onClose={() => {}} />);
      expect(screen.container.textContent).toBe("");
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it("treats a literal dash as a letter with split points on both sides", async () => {
      const line = setupLine({
        text: "to-do",
        words: [
          { text: "to-", begin: 0, end: 0.5 },
          { text: "do", begin: 0.5, end: 1 },
        ],
        language: "en-Latn",
        transliterationText: "to-do",
      });
      const screen = await render(<TransliterationAlignmentModal line={line} field="words" onClose={() => {}} />);
      await expect.element(screen.getByRole("button", { name: "Transliteration split point 2" })).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Transliteration split point 3" })).toBeInTheDocument();
      expect(document.querySelector('button[aria-label^="Transliteration dash"]')).toBeNull();
    });

    it("shows a word break separator with its own tooltip in the legend", async () => {
      const line = setupLine({
        text: "abcd",
        words: [
          { text: "ab", begin: 0, end: 0.5, transliteration: "ab", transliterationJoinerAfter: "  " },
          { text: "cd", begin: 0.5, end: 1, transliteration: "cd" },
        ],
        language: "en-Latn",
        transliterationText: "ab  cd",
      });
      const screen = await render(<TransliterationAlignmentModal line={line} field="words" onClose={() => {}} />);
      await expect
        .element(screen.getByRole("button", { name: "Transliteration word break 4" }))
        .toHaveAttribute("aria-pressed", "true");
      await screen.getByText("Word break", { exact: true }).hover();
      await expect.element(screen.getByRole("tooltip")).toHaveTextContent("Two spaces between words.");
    });
  });

  describe("invariants", () => {
    it("keeps Save disabled until the picked boundary count matches the required count", async () => {
      const line = setupLine();
      const screen = await render(<TransliterationAlignmentModal line={line} field="words" onClose={() => {}} />);
      const point = screen.getByRole("button", { name: "Transliteration split point 2", exact: true });
      await expect.element(point).toHaveAttribute("aria-pressed", "true");
      await point.click();
      await expect.element(point).toHaveAttribute("aria-pressed", "false");
      await expect.element(screen.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
      await expect.element(screen.getByText("Pick 1 split point (0 so far).")).toBeInTheDocument();
      await point.click();
      await expect.element(point).toHaveAttribute("aria-pressed", "true");
      await expect.element(screen.getByRole("button", { name: "Save", exact: true })).not.toBeDisabled();
    });
  });

  describe("regressions", () => {
    it("regression: saves per-word transliteration and joiners for a pronunciation break inside one lexical group", async () => {
      const words: WordTiming[] = [
        { text: "밤", begin: 0, end: 0.5, transliteration: "bam", transliterationJoinerAfter: " " },
        { text: "하", begin: 0.5, end: 1, transliteration: "ha", transliterationJoinerAfter: "  " },
        { text: "늘", begin: 1, end: 1.5, transliteration: "neul" },
      ];
      const line: LyricLine = {
        id: "bam-ha-neul",
        agentId: "v1",
        text: "밤하늘",
        words,
        transliteration: {
          language: "ko-Latn",
          text: "bam ha  neul",
          segments: [],
          origin: "manual",
          sourceFingerprint: languageSourceFingerprint("밤하늘"),
        },
      };
      useProjectStore.getState().setLines([line]);
      const screen = await render(<TransliterationAlignmentModal line={line} field="words" onClose={() => {}} />);

      const pronunciationBreak = screen.getByRole("button", {
        name: "Transliteration pronunciation break 4",
        exact: true,
      });
      await expect.element(pronunciationBreak).toHaveAttribute("aria-pressed", "true");
      await pronunciationBreak.click();
      await expect.element(screen.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
      await pronunciationBreak.click();
      await expect.element(pronunciationBreak).toHaveAttribute("aria-pressed", "true");

      await screen.getByRole("button", { name: "Save", exact: true }).click();
      const saved = useProjectStore.getState().lines[0];
      expect(saved.words).toEqual(words);
    });
  });

  describe("keyboard", () => {
    it("closes on Escape", async () => {
      const onClose = vi.fn();
      const line = setupLine();
      await render(<TransliterationAlignmentModal line={line} field="words" onClose={onClose} />);
      await userEvent.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalled();
    });
  });
});
