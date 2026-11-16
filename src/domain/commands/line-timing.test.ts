import { placeLineAt } from "insync/commands/line-timing";
import { bgBounds } from "insync/line-bounds";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";

beforeEach(() => useProjectStore.getState().reset());

describe("placeLineAt", () => {
  it("regression: an untimed background is timed with the line it is placed with", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [createLine({ id: "l1", text: "Paper boats", backgroundText: "drifting" })],
    });

    useProjectStore.getState().commit(placeLineAt("l1", 2, 4));

    expect(bgBounds(useProjectStore.getState().lines[0])).toEqual({ begin: 3, end: 4 });
  });
});
