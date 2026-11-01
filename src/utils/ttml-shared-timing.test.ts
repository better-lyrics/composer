import type { Agent } from "@/domain/agent/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { createGroup } from "@/test/factories";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { generateTTML } from "@/utils/ttml";
import { describe, expect, it } from "vitest";

const metadata: ProjectMetadata = { title: "Test", artists: [], album: "", duration: 60 };
const agents: Agent[] = [{ id: "v1", type: "person", name: "Lead" }];

function exportGroups(groups: ReturnType<typeof createGroup>[]) {
  return generateTTML({ metadata, agents, lines: [], groups });
}

describe("ttml · shared group timing", () => {
  it("round-trips sharesTiming and ownTimingInstances", () => {
    const group = createGroup({
      id: "g1",
      label: "Chorus",
      templateVersion: 1,
      sharesTiming: true,
      ownTimingInstances: [2, 5],
    });
    const parsed = parseLyricsFile("test.ttml", exportGroups([group]));
    expect(parsed.groups?.[0]).toEqual(group);
  });

  it("parses a group without the attributes as an old group", () => {
    const parsed = parseLyricsFile("test.ttml", exportGroups([createGroup({ id: "g1" })]));
    expect(parsed.groups?.[0]?.sharesTiming).toBeUndefined();
    expect(parsed.groups?.[0]?.ownTimingInstances).toBeUndefined();
  });

  it("omits empty ownTimingInstances", () => {
    const ttml = exportGroups([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [] })]);
    expect(ttml).toContain('sharesTiming="true"');
    expect(ttml).not.toContain("ownTimingInstances=");
  });

  describe("edge cases", () => {
    it("ignores malformed ownTimingInstances entries", () => {
      const ttml = exportGroups([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [9] })]).replace(
        'ownTimingInstances="9"',
        'ownTimingInstances="1,x,,-3,2"',
      );
      expect(parseLyricsFile("test.ttml", ttml).groups?.[0]?.ownTimingInstances).toEqual([1, 2]);
    });

    it("treats an empty ownTimingInstances attribute as none", () => {
      const ttml = exportGroups([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [9] })]).replace(
        'ownTimingInstances="9"',
        'ownTimingInstances=""',
      );
      expect(parseLyricsFile("test.ttml", ttml).groups?.[0]?.ownTimingInstances).toBeUndefined();
    });

    it("treats a sharesTiming value other than true as an old group", () => {
      const ttml = exportGroups([createGroup({ id: "g1", sharesTiming: true })]).replace(
        'sharesTiming="true"',
        'sharesTiming="yes"',
      );
      expect(parseLyricsFile("test.ttml", ttml).groups?.[0]?.sharesTiming).toBeUndefined();
    });
  });
});
