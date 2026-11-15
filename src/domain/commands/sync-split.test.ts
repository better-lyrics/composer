/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { splitSyncWord } from "@/domain/commands/sync";
import { lineText } from "@/domain/line/text";
import { useProjectStore } from "@/stores/project";
import { createLine, createWords } from "@/test/factories";

describe("sync split", () => {
  it("regression: a sync split keeps the untimed rest of the line", () => {
    useProjectStore.getState().reset();
    const line = createLine({
      id: "l1",
      text: "Paper lanterns drifting over the water",
      words: [
        { text: "Paper ", begin: 1, end: 1.4 },
        { text: "lanterns ", begin: 1.4, end: 2 },
      ],
    });
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [line]));
    const split = createWords([
      { text: "lan", begin: 1.4, end: 1.7, joinsNext: true },
      { text: "terns ", begin: 1.7, end: 2 },
    ]);
    useProjectStore.getState().commit(splitSyncWord("l1", 1, split));

    const [after] = useProjectStore.getState().lines;
    expect(lineText(after)).toBe("Paper lan|terns drifting over the water");
  });
});
