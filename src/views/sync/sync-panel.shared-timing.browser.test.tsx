import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { firstBegin, jumpToRow, key, lineById, load, song, tapAt, undo } from "@/test/shared-timing-sync";
import { setCurrentTime, setIsPlaying } from "@/test/sync-gesture-helpers";
import { SyncPanel } from "@/views/sync/sync-panel";
import { beforeEach, describe, expect, it } from "vitest";

// These tests cover gestures and holds after playback starts, not the count-in before it.
beforeEach(() => {
  useSettingsStore.setState({ syncCountIn: 0 });
});

// -- Tests --------------------------------------------------------------------

describe("SyncPanel · shared instance anchor", () => {
  it("syncs the first pass over Chorus 1 word by word", async () => {
    load(song());
    await render(<SyncPanel />);
    await tapAt(10, () => lineById("c0-0")?.words?.length);
    await tapAt(10.5, () => lineById("c0-0")?.words?.length);
    expect(lineById("c0-0")?.words?.map((word) => word.begin)).toEqual([10, 10.5]);
    expect(lineById("c1-0")?.words).toBeUndefined();
  });

  it("fills Chorus 2 with one tap and jumps the cursor past it", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    expect(lineById("c1-0")?.words?.map((word) => word.begin)).toEqual([40, 40.5]);
    expect(lineById("c1-1")?.words?.map((word) => word.begin)).toEqual([41, 41.5]);
    await tapAt(50, () => firstBegin("v2"));
    expect(firstBegin("v2")).toBe(50);
  });

  it("undo empties Chorus 2 and puts the cursor back on the anchor slot", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    await undo(() => firstBegin("c1-0"));
    expect(lineById("c1-1")?.words).toBeUndefined();
    await tapAt(42, () => firstBegin("c1-0"));
    expect(firstBegin("c1-0")).toBe(42);
    expect(firstBegin("c1-1")).toBe(43);
    expect(lineById("v2")?.words).toBeUndefined();
  });

  it("regression: undoes a placing tap after pausing", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    setIsPlaying(false);
    await expect.element(screen.getByText("2 skipped")).toBeInTheDocument();
    await undo(() => firstBegin("c1-0"));
    expect(lineById("c1-1")?.words).toBeUndefined();
  });

  it("moves a placed Chorus 2, and undo returns both the timing and the cursor", async () => {
    load(song({ first: "word", verse: "word", second: "word", secondBegin: 60 }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    expect(firstBegin("c1-1")).toBe(41);
    await undo(() => firstBegin("c1-0"));
    expect(firstBegin("c1-0")).toBe(60);
    expect(firstBegin("c1-1")).toBe(61);
    await tapAt(45, () => firstBegin("c1-0"));
    expect(firstBegin("c1-1")).toBe(46);
    expect(lineById("v2")?.words).toBeUndefined();
  });

  it("regression: keeps the cursor on the anchor slot when an edit follows the undo", async () => {
    load(song({ first: "word", verse: "word", second: "word", secondBegin: 60 }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    await undo(() => firstBegin("c1-0"));
    const verse = lineById("v1");
    useProjectStore
      .getState()
      .updateLineWithHistory(
        "v1",
        { words: verse?.words?.map((word) => ({ ...word, end: word.end + 0.05 })) },
        { deriveText: false, propagateToSiblings: false },
      );
    await tapAt(45, () => firstBegin("c1-0"));
    expect(firstBegin("c1-1")).toBe(46);
  });

  it("places Chorus 2 on a hold, and the release writes nothing", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    setCurrentTime(40);
    key({ key: "f", code: "KeyF" });
    await expect.poll(() => firstBegin("c1-1")).toBe(41);
    const placed = useProjectStore.getState().lines;
    setCurrentTime(44);
    key({ key: "f", code: "KeyF" }, "keyup");
    await tapAt(50, () => firstBegin("v2"));
    expect(useProjectStore.getState().lines.slice(0, 5)).toEqual(placed.slice(0, 5));
  });

  it("places Chorus 2 with one tap in line mode", async () => {
    load(song({ first: "line", verse: "line" }), "line");
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    expect(lineById("c1-0")).toMatchObject({ begin: 40, end: 41 });
    expect(lineById("c1-1")).toMatchObject({ begin: 41, end: 42 });
    await tapAt(50, () => firstBegin("v2"));
    expect(firstBegin("v2")).toBe(50);
  });

  describe("invariants", () => {
    it("keeps Chorus 1 in place when Chorus 2 is placed", async () => {
      load(song({ first: "word", verse: "word", second: "word", secondBegin: 60 }));
      const screen = await render(<SyncPanel />);
      const chorusOne = useProjectStore.getState().lines.slice(0, 2);
      await jumpToRow(screen, 3);
      await tapAt(40, () => firstBegin("c1-0"));
      expect(useProjectStore.getState().lines.slice(0, 2)).toEqual(chorusOne);
    });

    it("does not stretch the shared last word to the next tap after the jump", async () => {
      load(song({ first: "word", verse: "word" }));
      const screen = await render(<SyncPanel />);
      await jumpToRow(screen, 3);
      await tapAt(40, () => firstBegin("c1-0"));
      await tapAt(70, () => firstBegin("v2"));
      expect(lineById("c1-1")?.words?.[1]?.end).toBe(42);
      expect(lineById("c0-1")?.words?.[1]?.end).toBe(12);
    });
  });

  describe("labels", () => {
    it("asks for the placing tap, then marks the skipped lines as shared", async () => {
      load(song({ first: "word", verse: "word" }));
      const screen = await render(<SyncPanel />);
      await jumpToRow(screen, 3);
      await expect.element(screen.getByText("Tap to place")).toBeInTheDocument();
      await expect.element(screen.getByText("Chorus 2", { exact: true })).toBeInTheDocument();
      await tapAt(40, () => firstBegin("c1-0"));
      await expect.element(screen.getByText("Chorus 2 · shared").first()).toBeInTheDocument();
      expect(screen.container.textContent).not.toContain("Tap to place");
    });

    it("drops the skipped band once the whole song is synced", async () => {
      load(song({ first: "word", verse: "word" }));
      const screen = await render(<SyncPanel />);
      await jumpToRow(screen, 3);
      await tapAt(40, () => firstBegin("c1-0"));
      await tapAt(50, () => firstBegin("v2"));
      await tapAt(50.5, () => lineById("v2")?.words?.length);
      setIsPlaying(false);
      await expect.element(screen.getByText("Shared", { exact: true }).first()).toBeInTheDocument();
      expect(screen.container.textContent).not.toContain("2 skipped");
    });

    it("lists the skipped lines in the paused list, and Sync anyway gives the instance its own timing", async () => {
      load(song({ first: "word", verse: "word" }));
      const screen = await render(<SyncPanel />);
      await jumpToRow(screen, 3);
      await tapAt(40, () => firstBegin("c1-0"));
      setIsPlaying(false);
      await expect.element(screen.getByText("2 skipped")).toBeInTheDocument();
      expect(screen.getByText("Shared", { exact: true }).elements()).toHaveLength(2);
      await screen.getByRole("button", { name: "Sync anyway" }).click();
      expect(useProjectStore.getState().groups[0].ownTimingInstances).toEqual([1]);
      await expect.element(screen.getByText("2 skipped")).not.toBeInTheDocument();
      setIsPlaying(true);
      await tapAt(47, () => firstBegin("c1-0"));
      expect(firstBegin("c1-0")).toBe(47);
      expect(firstBegin("c0-0")).toBe(10);
    });
  });
});
