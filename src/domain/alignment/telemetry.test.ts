import { type AlignedLineRecord, buildTelemetryPayload, normalizedLyricsText } from "@/domain/alignment/telemetry";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";
import { checkPayload } from "../../../workers/alignment-telemetry/src/payload";

// -- Fixtures -----------------------------------------------------------------

const INSTALL_ID = "0b8f6c1e-3d2a-4c5b-9e7f-112233445566";
const SONG = { title: "Song", artists: ["Artist"], videoId: "dQw4w9WgXcQ", language: "en" };
const APP = { version: "2.31.0", commit: "abc1234" };

function record(lineId: string, text: string): AlignedLineRecord {
  return {
    lineId,
    text,
    model: { id: "hubertfa-v007", file: "hubertfa_v007_fp32_webgpu.onnx" },
    language: "en",
    taps: { begin: 1, end: 2 },
    window: { begin: 0.4, end: 2.15 },
    leadIn: "searched",
    track: "main",
    realign: false,
    fellBack: false,
    guessedWords: [],
    alignedAt: 1_700_000_000_000,
    aligned: [{ text: "hello", begin: 1.1, end: 1.6 }],
  };
}

function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, inner]) => [key, ...keysDeep(inner)]);
}

// -- Tests --------------------------------------------------------------------

describe("alignment telemetry payload", () => {
  it("hashes the lyrics text regardless of case, spacing and Unicode form", () => {
    const a = normalizedLyricsText([{ text: "  Café   Del\tMar " }, { text: "" }, { text: "Second LINE" }]);
    const b = normalizedLyricsText([{ text: "café del mar" }, { text: "second line" }]);
    expect(a).toBe("café del mar\nsecond line");
    expect(b).toBe(a);
  });

  it("pairs each aligned line with its exported timing, and nothing else", async () => {
    const kept = createLine({ id: "kept", text: "hello", words: [{ text: "hello", begin: 1.2, end: 1.7 }] });
    const lines = [kept, createLine({ id: "never-aligned", text: "other" })];
    const payload = await buildTelemetryPayload({
      installId: INSTALL_ID,
      app: APP,
      song: SONG,
      record: { lines: { kept: record("kept", "hello"), gone: record("gone", "deleted line") } },
      lines,
      ttml: "<tt/>",
    });
    expect(payload?.lines.map((line) => [line.lineId, line.final])).toEqual([
      ["kept", [{ text: "hello", begin: 1.2, end: 1.7 }]],
      ["gone", null],
    ]);
    expect(payload?.lyrics.textSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(payload?.lyrics.textSha256).not.toBe(payload?.lyrics.ttmlSha256);
    // The worker accepts exactly this shape, and it carries no audio.
    expect(checkPayload(JSON.parse(JSON.stringify(payload)))).toEqual({ ok: true });
    expect(keysDeep(payload).filter((key) => /audio|sample|pcm|wav|blob/i.test(key))).toEqual([]);
  });

  it("builds nothing when no aligned line is left in the song", async () => {
    const payload = await buildTelemetryPayload({
      installId: INSTALL_ID,
      app: APP,
      song: SONG,
      record: { lines: { gone: record("gone", "deleted line") } },
      lines: [createLine({ id: "other", text: "other", words: [{ text: "other", begin: 0, end: 1 }] })],
      ttml: "<tt/>",
    });
    expect(payload).toBeNull();
  });
});
