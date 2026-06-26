import { describe, expect, it } from "vitest";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { generateTTML } from "@/utils/ttml";

const metadata: ProjectMetadata = {
  title: "Song & Dance",
  artists: ['A "Q" B', "Kali Uchis"],
  album: "Flower Boy",
  duration: 0,
  isrc: "USQX91700001",
  songwriters: ["W1"],
  extra: { spotifyId: "abc" },
};
const lines = [{ id: "l1", text: "hi", begin: 1, end: 2, agentId: "v1" }];

describe("generateTTML metadata", () => {
  const ttml = generateTTML({ metadata, agents: [], lines, granularity: "line" });
  it("keeps the title in ttm:title", () => expect(ttml).toContain("<ttm:title>Song &amp; Dance</ttm:title>"));
  it("emits one composer:meta per artist", () => {
    expect(ttml).toContain('<composer:meta key="artists" value="Kali Uchis"/>');
  });
  it("escapes quotes inside attribute values", () => {
    expect(ttml).toContain('<composer:meta key="artists" value="A &quot;Q&quot; B"/>');
  });
  it("emits album, isrc, songwriter, extra", () => {
    expect(ttml).toContain('<composer:meta key="album" value="Flower Boy"/>');
    expect(ttml).toContain('<composer:meta key="isrc" value="USQX91700001"/>');
    expect(ttml).toContain('<composer:meta key="songwriter" value="W1"/>');
    expect(ttml).toContain('<composer:meta key="spotifyId" value="abc"/>');
  });
  it("emits no composer:meta when there is no extended metadata", () => {
    const bare = generateTTML({
      metadata: { title: "x", artists: [], album: "", duration: 0 },
      agents: [],
      lines,
      granularity: "line",
    });
    expect(bare).not.toContain("composer:meta");
  });
});
