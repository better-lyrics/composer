import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { useSettingsStore } from "@/stores/settings";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("languageSourceFingerprint", () => {
  let previousSplitCharacter: string;

  beforeEach(() => {
    previousSplitCharacter = useSettingsStore.getState().splitCharacter;
    useSettingsStore.getState().set("splitCharacter", "|");
  });

  afterEach(() => useSettingsStore.getState().set("splitCharacter", previousSplitCharacter));

  it("ignores structural syllable markers in the main text", () => {
    expect(languageSourceFingerprint("to-|do")).toBe(languageSourceFingerprint("to-do"));
  });

  it("ignores structural syllable markers in background text", () => {
    expect(languageSourceFingerprint("main", "to-|do")).toBe(languageSourceFingerprint("main", "to-do"));
  });

  it("still detects semantic source changes", () => {
    expect(languageSourceFingerprint("to-do")).not.toBe(languageSourceFingerprint("to do"));
  });
});
