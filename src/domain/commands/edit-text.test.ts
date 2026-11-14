/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from "vitest";
import { editBackgroundText } from "@/domain/commands/edit-text";
import { withSeededBackground } from "@/domain/line/background";
import { backgroundText } from "@/domain/line/text";
import { backgroundTrack } from "@/domain/line/track";
import { withBackgroundTrack, withTrackSpan } from "@/domain/line/track-writes";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";

beforeEach(() => useProjectStore.getState().reset());

describe("editBackgroundText", () => {
  it("regression: a line-synced background keeps its moved span when its text is retyped", () => {
    const seeded = withSeededBackground(
      createLine({ id: "l1", text: "Low tide", begin: 2, end: 6, backgroundText: "ooh" }),
    );
    const moved = withBackgroundTrack(seeded, withTrackSpan(backgroundTrack(seeded)!, 4.5, 5.5));
    useProjectStore.setState({ lines: [moved] });

    useProjectStore.getState().commit(editBackgroundText("l1", "ooh yeah"));

    const [line] = useProjectStore.getState().lines;
    expect(backgroundText(line)).toBe("ooh yeah");
    expect(backgroundTrack(line)).toMatchObject({ begin: 4.5, end: 5.5, source: "manual" });
  });
});
