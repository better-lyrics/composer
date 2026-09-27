import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LyricLine } from "@/domain/line/model";
import { render } from "@/test/render";
import { LanguageStatusSummaries } from "@/views/languages/status-summaries";
import { describe, expect, it } from "vitest";

function reviewLine(stale: boolean, guessed: boolean): LyricLine {
  return {
    id: "l1",
    text: "가나",
    agentId: "v1",
    transliteration: {
      language: "ko-Latn",
      text: "gana",
      segments: [],
      origin: "manual",
      sourceFingerprint: stale ? "old" : languageSourceFingerprint("가나"),
      alignmentStatus: guessed ? "needs-review" : "inferred",
    },
  };
}

describe("LanguageStatusSummaries", () => {
  it.each([
    [false, true, "Check the estimated transliteration boundaries with Align."],
    [true, false, "The lyric changed after these were written."],
    [true, true, "Some lyrics changed, and some transliteration boundaries need checking."],
  ] as const)("explains the actual review cause (stale=%s, guessed=%s)", async (stale, guessed, helper) => {
    const screen = await render(
      <LanguageStatusSummaries lines={[reviewLine(stale, guessed)]} languageNames={new Map()} />,
    );
    await expect.element(screen.getByText(helper)).toBeInTheDocument();
  });

  it("does not warn for confident inferred alignment", async () => {
    const screen = await render(
      <LanguageStatusSummaries lines={[reviewLine(false, false)]} languageNames={new Map()} />,
    );
    expect(screen.container.querySelector("aside")).toBeNull();
  });
});
