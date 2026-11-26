import type { SyllableAddress } from "@/domain/selection/model";
import { nextTrackSelection } from "@/views/timeline/track-selection";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function word(lineId: string, wordIndex: number): SyllableAddress {
  return { lineId, type: "word", syllableId: `${lineId}-${wordIndex}` };
}

// -- Tests --------------------------------------------------------------------

describe("nextTrackSelection", () => {
  it("keeps the same object when only another track's selection changes", () => {
    const verse = nextTrackSelection([word("verse", 0), word("chorus", 0)], "verse", "word", null);
    const next = nextTrackSelection([word("verse", 0), word("chorus", 0), word("chorus", 1)], "verse", "word", verse);
    expect(next).toBe(verse);
  });

  it("returns a new value when the track's own selection changes", () => {
    const verse = nextTrackSelection([word("verse", 0)], "verse", "word", null);
    const next = nextTrackSelection([word("verse", 0), word("verse", 1)], "verse", "word", verse);
    expect(next).not.toBe(verse);
    expect([...next.selectedIds]).toEqual(["verse-0", "verse-1"]);
  });

  it("changes when the whole selection goes from empty to non-empty and back", () => {
    const empty = nextTrackSelection([], "verse", "word", null);
    const elsewhere = nextTrackSelection([word("chorus", 0)], "verse", "word", empty);
    expect(elsewhere).not.toBe(empty);
    expect(elsewhere.hasSelection).toBe(true);
    const cleared = nextTrackSelection([], "verse", "word", elsewhere);
    expect(cleared.hasSelection).toBe(false);
  });
});
