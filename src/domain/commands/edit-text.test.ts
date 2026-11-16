/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from "vitest";
import { editBackgroundText, typeLyrics } from "insync/commands/edit-text";
import { syncGesture } from "insync/commands/sync";
import { bgBounds } from "insync/line-bounds";
import { decideEditTextAction } from "@/domain/edit-text/decide-edit-text-action";
import { withSeededBackground } from "insync/line-background";
import { backgroundText, lineText } from "insync/line-text";
import { backgroundTrack, mainTrack, timedSyllables } from "insync/line-track";
import { withBackgroundTrack, withTrackSpan } from "insync/line-track-writes";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";
import { getSplitCharacter } from "@/utils/split-character";

beforeEach(() => useProjectStore.getState().reset());

describe("editBackgroundText", () => {
  it("regression: a line-synced background keeps its moved span when its text is retyped", () => {
    const seeded = withSeededBackground(
      createLine({ id: "l1", text: "Low tide", begin: 2, end: 6, backgroundText: "ooh" }),
      DEFAULT_SPLIT_CHARACTER,
    );
    const moved = withBackgroundTrack(seeded, withTrackSpan(backgroundTrack(seeded)!, 4.5, 5.5));
    useProjectStore.setState({ lines: [moved] });

    useProjectStore.getState().commit(editBackgroundText("l1", "ooh yeah"));

    const [line] = useProjectStore.getState().lines;
    expect(backgroundText(line, getSplitCharacter())).toBe("ooh yeah");
    expect(backgroundTrack(line)).toMatchObject({ begin: 4.5, end: 5.5, source: "manual" });
  });

  it("regression: a background typed on a line a Line mode tap left open is timed from the tap", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [createLine({ id: "l1", text: "Paper boats" }), createLine({ id: "l2", text: "Harbour lights" })],
    });
    const tapLine = (lineIndex: number, time: number) =>
      syncGesture(
        "tap-line",
        { cursor: { lineIndex, wordIndex: 0 }, jumped: false, time, defaultWordDuration: 0.5 },
        () => {},
      );

    useProjectStore.getState().commit(tapLine(0, 2));
    useProjectStore.getState().commit(editBackgroundText("l1", "drifting"));
    useProjectStore.getState().commit(tapLine(1, 5));

    expect(bgBounds(useProjectStore.getState().lines[0])?.begin).toBe(2);
  });
});

describe("typing in one instance of a group", () => {
  const chorus = (instanceIdx: number, begin: number) =>
    createLine({
      id: `glow-${instanceIdx}`,
      text: "We glow tonight",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
      words: [
        { text: "We", sep: " ", begin, end: begin + 0.4 },
        { text: "glow", sep: " ", begin: begin + 0.4, end: begin + 1 },
        { text: "tonight", begin: begin + 1, end: begin + 1.6 },
      ],
    });

  it.each([true, false])(
    "regression: the typed instance keeps its edit and timing when an earlier instance takes it (shared %s)",
    (sharesTiming) => {
      useProjectStore.getState().restoreLyrics({
        lines: [chorus(0, 10), chorus(1, 40)],
        groups: [
          { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1, ...(sharesTiming && { sharesTiming }) },
        ],
      });
      const { lines, groups } = useProjectStore.getState();
      const action = decideEditTextAction({
        text: "We glow tonight\nWe glow so bright tonight",
        defaultAgentId: "v1",
        lines,
        groups,
        splitCharacter: DEFAULT_SPLIT_CHARACTER,
      });
      if (action.kind !== "apply") throw new Error(action.kind);
      const typed = action.finalLines[1];

      useProjectStore.getState().commit(typeLyrics(lines, action.finalLines), "pending");

      const [earlier, edited] = useProjectStore.getState().lines;
      expect(lineText(edited, getSplitCharacter())).toBe("We glow so bright tonight");
      expect(timedSyllables(mainTrack(edited))).toEqual(timedSyllables(mainTrack(typed)));
      expect(lineText(earlier, getSplitCharacter())).toBe("We glow so bright tonight");
    },
  );
});
