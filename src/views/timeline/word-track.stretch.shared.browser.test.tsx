import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import {
  movePointer,
  pressEdge,
  releasePointer,
  renderStretchTrack,
} from "@/views/timeline/word-track.stretch-harness";
import { describe, expect, it } from "vitest";

const words = () => [
  createWord({ text: "go ", begin: 1, end: 2 }),
  createWord({ text: "now ", begin: 2, end: 3 }),
  createWord({ text: "yeah", begin: 5, end: 6 }),
];

async function renderSharedStretch() {
  const fixture = await renderStretchTrack(words(), [0, 1]);
  const source = useProjectStore.getState().lines[0];
  useProjectStore.setState({
    groups: [createGroup({ id: "g1", sharesTiming: true })],
    lines: [
      { ...source, groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      createLine({
        id: "sibling",
        text: "go now yeah",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: words().map((word) => ({ ...word, begin: word.begin + 20, end: word.end + 20 })),
      }),
    ],
  });
  return fixture;
}

const siblingWordEnd = (index: number) =>
  useProjectStore.getState().lines.find((line) => line.id === "sibling")?.words?.[index]?.end;

describe("WordTrack selection stretch on a shared line", () => {
  it("regression: the preview moves the shared copy the way the release will", async () => {
    const { blocks } = await renderSharedStretch();

    pressEdge(blocks[1], "right");
    movePointer(100);
    const previewEnd = siblingWordEnd(1);
    releasePointer(100);

    expect(previewEnd).toBeCloseTo(24, 5);
    expect(siblingWordEnd(1)).toBeCloseTo(previewEnd ?? Number.NaN, 5);
  });
});
