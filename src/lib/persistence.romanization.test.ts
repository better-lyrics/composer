import { describe, expect, it } from "vitest";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { importProjectFromFile } from "@/lib/persistence";

// -- Helpers ------------------------------------------------------------------

const BASE_METADATA: ProjectMetadata = {
  title: "Night Dancer",
  artist: "imase",
  album: "",
  duration: 0,
};

async function fileRoundtrip(payload: object): Promise<ReturnType<typeof importProjectFromFile>> {
  const file = new File([JSON.stringify(payload)], "song.ttml-project.json", { type: "application/json" });
  return importProjectFromFile(file);
}

// -- Project file (JSON) round-trip -------------------------------------------

describe("persistence: romanization round-trip", () => {
  it("preserves metadata.romanizationScheme", async () => {
    const parsed = await fileRoundtrip({
      version: 1,
      savedAt: Date.now(),
      metadata: { ...BASE_METADATA, romanizationScheme: "ja-Latn-hepburn" },
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word",
    });
    expect(parsed.metadata.romanizationScheme).toBe("ja-Latn-hepburn");
  });

  it("preserves metadata.romanizationBannerDismissed", async () => {
    const parsed = await fileRoundtrip({
      version: 1,
      savedAt: Date.now(),
      metadata: { ...BASE_METADATA, romanizationBannerDismissed: true },
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "line",
    });
    expect(parsed.metadata.romanizationBannerDismissed).toBe(true);
  });

  it("preserves word-synced line romanization with per-word texts", async () => {
    const line: LyricLine = {
      id: "L1",
      text: "夜だけど",
      agentId: DEFAULT_AGENTS[0].id,
      words: [
        { text: "夜", begin: 0, end: 1 },
        { text: "だけど", begin: 1, end: 2 },
      ],
      romanization: {
        text: "yoru dakedo",
        source: "generated",
        wordTexts: ["yoru", "dakedo"],
      },
    };
    const parsed = await fileRoundtrip({
      version: 1,
      savedAt: Date.now(),
      metadata: { ...BASE_METADATA, romanizationScheme: "ja-Latn-hepburn" },
      agents: DEFAULT_AGENTS,
      lines: [line],
      groups: [],
      granularity: "word",
    });
    expect(parsed.lines[0].romanization?.text).toBe("yoru dakedo");
    expect(parsed.lines[0].romanization?.wordTexts).toEqual(["yoru", "dakedo"]);
    expect(parsed.lines[0].romanization?.source).toBe("generated");
  });

  it("upgrades a v1-shape stored project: r.words[].text becomes wordTexts and timing is dropped", async () => {
    const v1Project = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata: { ...BASE_METADATA, romanizationScheme: "ja-Latn-hepburn" },
      agents: DEFAULT_AGENTS,
      lines: [
        {
          id: "L1",
          text: "夜だけど",
          agentId: DEFAULT_AGENTS[0].id,
          words: [
            { text: "夜", begin: 0, end: 1 },
            { text: "だけど", begin: 1, end: 2 },
          ],
          romanization: {
            text: "yoru dakedo",
            source: "generated" as const,
            words: [
              { text: "yoru", begin: 0, end: 1 },
              { text: "dakedo", begin: 1, end: 2 },
            ],
          },
        },
      ],
      groups: [],
      granularity: "word" as const,
    };
    const parsed = await fileRoundtrip(v1Project as never);
    expect(parsed.lines[0].romanization?.wordTexts).toEqual(["yoru", "dakedo"]);
    expect((parsed.lines[0].romanization as { words?: unknown }).words).toBeUndefined();
  });

  it("preserves line-synced line romanization without words", async () => {
    const line: LyricLine = {
      id: "L1",
      text: "夜だけど",
      agentId: DEFAULT_AGENTS[0].id,
      begin: 0,
      end: 4,
      romanization: { text: "yoru dakedo", source: "manual" },
    };
    const parsed = await fileRoundtrip({
      version: 1,
      savedAt: Date.now(),
      metadata: { ...BASE_METADATA, romanizationScheme: "ja-Latn-hepburn" },
      agents: DEFAULT_AGENTS,
      lines: [line],
      groups: [],
      granularity: "line",
    });
    expect(parsed.lines[0].romanization?.text).toBe("yoru dakedo");
    expect(parsed.lines[0].romanization?.words).toBeUndefined();
    expect(parsed.lines[0].romanization?.source).toBe("manual");
  });

  it("preserves mixed romanized and non-romanized lines independently", async () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "夜だけど",
        agentId: DEFAULT_AGENTS[0].id,
        romanization: { text: "yoru dakedo", source: "manual" },
      },
      { id: "L2", text: "hello", agentId: DEFAULT_AGENTS[0].id },
    ];
    const parsed = await fileRoundtrip({
      version: 1,
      savedAt: Date.now(),
      metadata: { ...BASE_METADATA, romanizationScheme: "ja-Latn-hepburn" },
      agents: DEFAULT_AGENTS,
      lines,
      groups: [],
      granularity: "line",
    });
    expect(parsed.lines[0].romanization?.text).toBe("yoru dakedo");
    expect(parsed.lines[1].romanization).toBeUndefined();
  });

  it("legacy project file without romanization remains valid", async () => {
    const parsed = await fileRoundtrip({
      version: 1,
      savedAt: Date.now(),
      metadata: BASE_METADATA,
      agents: DEFAULT_AGENTS,
      lines: [{ id: "L1", text: "hello", agentId: DEFAULT_AGENTS[0].id }],
      groups: [],
      granularity: "line",
    });
    expect(parsed.metadata.romanizationScheme).toBeUndefined();
    expect(parsed.metadata.romanizationBannerDismissed).toBeUndefined();
    expect(parsed.lines[0].romanization).toBeUndefined();
  });
});
