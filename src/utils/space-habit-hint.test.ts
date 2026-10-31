import { type SpaceHintMoment, shouldOfferSpaceHint } from "@/utils/space-habit-hint";
import { describe, expect, it } from "vitest";

const SPACE_DID_NOTHING: SpaceHintMoment = {
  preset: "composer",
  playOverridden: false,
  answered: false,
  activeTab: "import",
  hasAudio: true,
  spaceDidNothing: true,
};

const SPACE_THEN_PLAY: SpaceHintMoment = {
  ...SPACE_DID_NOTHING,
  activeTab: "timeline",
  spaceDidNothing: false,
  spaceAt: 1000,
  playAt: 1800,
};

describe("shouldOfferSpaceHint", () => {
  it("offers when Space does nothing where the user pressed it", () => {
    expect(shouldOfferSpaceHint(SPACE_DID_NOTHING)).toBe(true);
  });

  it("offers when Space did something else and play by its own key followed soon after", () => {
    expect(shouldOfferSpaceHint(SPACE_THEN_PLAY)).toBe(true);
  });

  it.each([
    ["another preset is in use", { preset: "editor" }],
    ["play already has the user's own key", { playOverridden: true }],
    ["the user already answered", { answered: true }],
    ["no song is loaded, so play would do nothing", { hasAudio: false }],
    ["Space taps in Sync", { activeTab: "sync" }],
  ] as const)("does not offer when %s", (_, change) => {
    expect(shouldOfferSpaceHint({ ...SPACE_DID_NOTHING, ...change })).toBe(false);
    expect(shouldOfferSpaceHint({ ...SPACE_THEN_PLAY, ...change })).toBe(false);
  });

  describe("edge cases", () => {
    it("does not offer when Space did something and play never followed", () => {
      expect(shouldOfferSpaceHint({ ...SPACE_THEN_PLAY, playAt: undefined })).toBe(false);
    });

    it("offers at exactly 2000 ms and not at 2001 ms", () => {
      expect(shouldOfferSpaceHint({ ...SPACE_THEN_PLAY, spaceAt: 0, playAt: 2000 })).toBe(true);
      expect(shouldOfferSpaceHint({ ...SPACE_THEN_PLAY, spaceAt: 0, playAt: 2001 })).toBe(false);
    });

    it("does not offer when play came before Space", () => {
      expect(shouldOfferSpaceHint({ ...SPACE_THEN_PLAY, spaceAt: 2000, playAt: 1000 })).toBe(false);
    });
  });
});
