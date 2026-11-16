/**
 * @vitest-environment node
 */

import { editBackgroundText, typeLyrics } from "insync/commands/edit-text";
import { syncGesture } from "insync/commands/sync";
import { withSeededBackground } from "insync/line-background";
import { bgBounds } from "insync/line-bounds";
import { backgroundText, lineText } from "insync/line-text";
import { backgroundTrack, mainTrack, timedSyllables } from "insync/line-track";
import { withBackgroundTrack, withTrackSpan } from "insync/line-track-writes";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";
import { beforeEach, describe, expect, it } from "vitest";
import { decideEditTextAction } from "@/domain/edit-text/decide-edit-text-action";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { getSplitCharacter } from "@/utils/split-character";

beforeEach(() => {
  useProjectStore.getState().reset();
  useAudioStore.getState().reset();
});

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

  it("regression: a background added to a line left open near the song's end ends with the song", () => {
    useAudioStore.setState({ duration: 10 });
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "l1", text: "Paper boats" })] });
    useProjectStore
      .getState()
      .commit(
        syncGesture(
          "tap-line",
          { cursor: { lineIndex: 0, wordIndex: 0 }, jumped: false, time: 9.9, defaultWordDuration: 0.5 },
          () => {},
        ),
      );

    useProjectStore.getState().commit(editBackgroundText("l1", "drifting away"));

    expect(bgBounds(useProjectStore.getState().lines[0])).toEqual({ begin: 9.9, end: 10 });
  });

  it("regression: a word added after the last timed background word stays untimed, as in main text", () => {
    useProjectStore.setState({
      lines: [
        createLine({
          id: "l1",
          text: "Paper boats",
          words: [
            { text: "Paper", sep: " ", begin: 1, end: 2 },
            { text: "boats", begin: 2, end: 3 },
          ],
          backgroundText: "mel ren",
          backgroundWords: [
            { text: "mel", sep: " ", begin: 1.5, end: 2 },
            { text: "ren", begin: 2, end: 2.5 },
          ],
        }),
      ],
    });

    useProjectStore.getState().commit(editBackgroundText("l1", "mel ren ka"));

    const [line] = useProjectStore.getState().lines;
    expect(backgroundText(line, getSplitCharacter())).toBe("mel ren ka");
    expect(timedSyllables(backgroundTrack(line)).map((word) => [word.text, word.begin, word.end])).toEqual([
      ["mel", 1.5, 2],
      ["ren", 2, 2.5],
    ]);
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
