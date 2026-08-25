import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import type { LyricsSearchResult } from "@/domain/lyrics-search/result";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { isAbortError as sharedIsAbortError } from "@/utils/abort-error";
import {
  isAbortError,
  payloadToContent,
  syntheticFilenameForResult,
  wrapTextAsParseResult,
} from "@/views/lyrics-import-modal/shell-helpers";

// -- Helpers ------------------------------------------------------------------

function buildResult(overrides: Partial<LyricsSearchResult> = {}): LyricsSearchResult {
  return {
    id: "42",
    source: "lrclib",
    sourceLabel: "LRCLib",
    syncType: "line",
    track: "Bohemian Rhapsody",
    artist: "Queen",
    album: "A Night at the Opera",
    durationSec: 355,
    payload: { kind: "lrc", synced: "[00:00.00]hi", plain: null },
    ...overrides,
  };
}

function buildLine(text: string): LyricLine {
  return { id: `line-${text}`, text, agentId: "v1" };
}

function dataUrl(body: string): string {
  return `data:text/plain,${encodeURIComponent(body)}`;
}

// -- Tests --------------------------------------------------------------------

describe("syntheticFilenameForResult", () => {
  it("names an lrc payload with a .lrc extension", () => {
    expect(syntheticFilenameForResult(buildResult())).toBe("lrclib-42.lrc");
  });

  it("names a ttml payload with a .ttml extension", () => {
    const result = buildResult({ source: "boidu-lyrics", payload: { kind: "ttml", xml: "<tt/>" } });
    expect(syntheticFilenameForResult(result)).toBe("boidu-lyrics-42.ttml");
  });

  it("names a deferred ttml payload with a .ttml extension", () => {
    const result = buildResult({ source: "binimum", payload: { kind: "deferred-ttml", fetchUrl: "/lyrics" } });
    expect(syntheticFilenameForResult(result)).toBe("binimum-42.ttml");
  });

  it("names a qrc payload with a .qrc extension", () => {
    const result = buildResult({ source: "qq", payload: { kind: "qrc", raw: WANDERLUST_QRC } });
    expect(syntheticFilenameForResult(result)).toBe("qq-42.qrc");
    expect(syntheticFilenameForResult(result)).toMatch(/\.qrc$/);
  });
});

describe("payloadToContent", () => {
  it("returns the raw QRC body for a qrc payload", async () => {
    const result = buildResult({ source: "qq", payload: { kind: "qrc", raw: WANDERLUST_QRC } });
    const content = await payloadToContent(result, new AbortController().signal);
    expect(content).toBe(WANDERLUST_QRC);
  });

  it("returns the xml for a ttml payload", async () => {
    const result = buildResult({ payload: { kind: "ttml", xml: "<tt/>" } });
    expect(await payloadToContent(result, new AbortController().signal)).toBe("<tt/>");
  });

  it("prefers the synced body of an lrc payload", async () => {
    const result = buildResult({ payload: { kind: "lrc", synced: "[00:00.00]synced", plain: "plain" } });
    expect(await payloadToContent(result, new AbortController().signal)).toBe("[00:00.00]synced");
  });

  it("falls back to the plain body when an lrc payload has no synced text", async () => {
    const result = buildResult({ payload: { kind: "lrc", synced: null, plain: "plain" } });
    expect(await payloadToContent(result, new AbortController().signal)).toBe("plain");
  });

  it("fetches a deferred ttml payload", async () => {
    const result = buildResult({ payload: { kind: "deferred-ttml", fetchUrl: dataUrl("<tt/>") } });
    expect(await payloadToContent(result, new AbortController().signal)).toBe("<tt/>");
  });

  describe("edge cases", () => {
    it("returns null when an lrc payload carries neither body", async () => {
      const result = buildResult({ payload: { kind: "lrc", synced: null, plain: null } });
      expect(await payloadToContent(result, new AbortController().signal)).toBeNull();
    });

    it("returns null when a deferred fetch comes back empty", async () => {
      const result = buildResult({ payload: { kind: "deferred-ttml", fetchUrl: dataUrl("") } });
      expect(await payloadToContent(result, new AbortController().signal)).toBeNull();
    });

    it("returns an empty qrc body verbatim rather than falling through to a fetch", async () => {
      const result = buildResult({ source: "qq", payload: { kind: "qrc", raw: "" } });
      expect(await payloadToContent(result, new AbortController().signal)).toBe("");
    });
  });

  describe("invariants", () => {
    it("never mutates the payload it reads", async () => {
      const payload = { kind: "qrc", raw: WANDERLUST_QRC } as const;
      const result = buildResult({ source: "qq", payload });
      await payloadToContent(result, new AbortController().signal);
      expect(payload).toEqual({ kind: "qrc", raw: WANDERLUST_QRC });
    });

    it("resolves a local payload without touching the network signal", async () => {
      const controller = new AbortController();
      controller.abort();
      const result = buildResult({ source: "qq", payload: { kind: "qrc", raw: WANDERLUST_QRC } });
      expect(await payloadToContent(result, controller.signal)).toBe(WANDERLUST_QRC);
    });
  });

  describe("error paths", () => {
    it("throws when a deferred fetch fails", async () => {
      const result = buildResult({ payload: { kind: "deferred-ttml", fetchUrl: "not a url" } });
      await expect(payloadToContent(result, new AbortController().signal)).rejects.toThrow();
    });
  });
});

describe("wrapTextAsParseResult", () => {
  it("wraps lines with empty metadata and no timing", () => {
    const lines = [buildLine("one"), buildLine("two")];
    expect(wrapTextAsParseResult(lines)).toEqual({ lines, metadata: {}, hasTimingData: false });
  });

  it("keeps the same line references it was given", () => {
    const lines = [buildLine("one")];
    expect(wrapTextAsParseResult(lines).lines[0]).toBe(lines[0]);
  });

  it("wraps an empty list without inventing lines", () => {
    expect(wrapTextAsParseResult([]).lines).toEqual([]);
  });
});

describe("isAbortError", () => {
  it("re-exports the shared predicate rather than keeping a local copy", () => {
    expect(isAbortError).toBe(sharedIsAbortError);
  });
});
