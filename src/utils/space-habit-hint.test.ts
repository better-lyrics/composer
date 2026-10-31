import { describe, expect, it } from "vitest";
import { type SpaceHintMoment, shouldOfferSpaceHint } from "@/utils/space-habit-hint";

const HABIT: SpaceHintMoment = {
  preset: "composer",
  playOverridden: false,
  answered: false,
  activeTab: "timeline",
  spaceAt: 1000,
  playAt: 1800,
};

describe("shouldOfferSpaceHint", () => {
  it("offers when Space was pressed and play followed soon after", () => {
    expect(shouldOfferSpaceHint(HABIT)).toBe(true);
  });

  it.each([
    ["another preset is in use", { preset: "editor" }],
    ["play already has the user's own key", { playOverridden: true }],
    ["the user already answered", { answered: true }],
    ["Space taps in Sync", { activeTab: "sync" }],
    ["Space was never pressed", { spaceAt: undefined }],
  ] as const)("does not offer when %s", (_, change) => {
    expect(shouldOfferSpaceHint({ ...HABIT, ...change })).toBe(false);
  });

  describe("edge cases", () => {
    it("offers at exactly 2000 ms and not at 2001 ms", () => {
      expect(shouldOfferSpaceHint({ ...HABIT, spaceAt: 0, playAt: 2000 })).toBe(true);
      expect(shouldOfferSpaceHint({ ...HABIT, spaceAt: 0, playAt: 2001 })).toBe(false);
    });

    it("does not offer when play came before Space", () => {
      expect(shouldOfferSpaceHint({ ...HABIT, spaceAt: 2000, playAt: 1000 })).toBe(false);
    });
  });
});
