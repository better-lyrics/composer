import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { useSettingsStore } from "@/stores/settings";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSplitCharacter } from "@/utils/split-character";

describe("languageSourceFingerprint", () => {
  let previousSplitCharacter: string;

  beforeEach(() => {
    previousSplitCharacter = useSettingsStore.getState().splitCharacter;
    useSettingsStore.getState().set("splitCharacter", "|");
  });

  afterEach(() => useSettingsStore.getState().set("splitCharacter", previousSplitCharacter));

  it("ignores structural syllable markers in the main text", () => {
    expect(languageSourceFingerprint(getSplitCharacter(), "to-|do")).toBe(
      languageSourceFingerprint(getSplitCharacter(), "to-do"),
    );
  });

  it("ignores structural syllable markers in background text", () => {
    expect(languageSourceFingerprint(getSplitCharacter(), "main", "to-|do")).toBe(
      languageSourceFingerprint(getSplitCharacter(), "main", "to-do"),
    );
  });

  it("still detects semantic source changes", () => {
    expect(languageSourceFingerprint(getSplitCharacter(), "to-do")).not.toBe(
      languageSourceFingerprint(getSplitCharacter(), "to do"),
    );
  });
});
