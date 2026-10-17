import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { createLine } from "@/test/factories";
import { generateTTML, withoutAudioDuration } from "@/utils/ttml";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const LINES = [createLine({ id: "a", text: "Hello", begin: 1, end: 2 })];

function exported(duration?: number): string {
  return generateTTML({ metadata: normalizeLoadedMetadata(null), agents: DEFAULT_AGENTS, lines: LINES, duration });
}

// -- Tests --------------------------------------------------------------------

describe("withoutAudioDuration", () => {
  it("makes exports that differ only in audio duration equal", () => {
    expect(withoutAudioDuration(exported(180))).toBe(withoutAudioDuration(exported(212.5)));
  });

  it("matches the export written without a duration", () => {
    expect(withoutAudioDuration(exported(180))).toBe(exported());
  });

  describe("edge cases", () => {
    it("leaves an export without a duration unchanged", () => {
      expect(withoutAudioDuration(exported())).toBe(exported());
    });

    it("keeps real changes visible", () => {
      const edited = exported(180).replace(">Hello<", ">Hello there<");
      expect(withoutAudioDuration(edited)).not.toBe(withoutAudioDuration(exported(180)));
    });
  });

  describe("invariants", () => {
    it("is idempotent", () => {
      const once = withoutAudioDuration(exported(180));
      expect(withoutAudioDuration(once)).toBe(once);
    });
  });
});
