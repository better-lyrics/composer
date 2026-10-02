import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { setCurrentTime } from "@/test/sync-gesture-helpers";
import { GroupingSuggestionsBanner } from "@/views/grouping/grouping-suggestions-banner";
import { SyncPanel } from "@/views/sync/sync-panel";
import { beforeEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function song(): LyricLine[] {
  return [
    createLine({ id: "one-a", text: "go now" }),
    createLine({ id: "one-b", text: "stay here" }),
    createLine({ id: "two-a", text: "go now" }),
    createLine({ id: "two-b", text: "stay here" }),
    createLine({ id: "verse", text: "walking home" }),
  ];
}

// -- Helpers ------------------------------------------------------------------

function load(granularity: "line" | "word") {
  useSettingsStore.setState({ shareTimingInNewGroups: true });
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration: 120,
    currentTime: 0,
    isPlaying: true,
  });
  useProjectStore.setState({ lines: song(), groups: [], activeTab: "sync", granularity });
  useProjectStore.getState().clearHistory();
}

const lineById = (id: string) => useProjectStore.getState().lines.find((line) => line.id === id);
const firstBegin = (id: string) => {
  const line = lineById(id);
  return line?.words?.[0]?.begin ?? line?.begin;
};

async function tapAt(time: number, changed: () => unknown): Promise<void> {
  const before = changed();
  setCurrentTime(time);
  window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }));
  await expect.poll(changed).not.toEqual(before);
}

// -- Tests --------------------------------------------------------------------

describe("SyncPanel · grouping mid-sync", () => {
  beforeEach(() => load("line"));

  it("regression: the next tap after grouping lands past the shared instance and never moves the source", async () => {
    await render(<SyncPanel />);
    await tapAt(10, () => firstBegin("one-a"));
    await tapAt(13, () => firstBegin("one-b"));
    await tapAt(40, () => firstBegin("two-a"));

    useProjectStore.getState().groupRepeatingSections([0, 2], 2);
    expect(firstBegin("two-b")).toBe(43);

    await tapAt(44.5, () => firstBegin("verse"));
    expect(firstBegin("verse")).toBe(44.5);
    expect(firstBegin("one-b")).toBe(13);
    expect(firstBegin("two-b")).toBe(43);
  });

  it("syncs one chorus and part of the next, groups from the Edit banner, and skips the grouped chorus", async () => {
    const screen = await render(
      <>
        <GroupingSuggestionsBanner />
        <SyncPanel />
      </>,
    );
    await tapAt(10, () => firstBegin("one-a"));
    await tapAt(13, () => firstBegin("one-b"));
    await tapAt(40, () => firstBegin("two-a"));

    await screen.getByRole("button", { name: "Group them" }).click();
    await expect.poll(() => useProjectStore.getState().groups.length).toBe(1);

    await tapAt(44.5, () => firstBegin("verse"));
    expect(firstBegin("verse")).toBe(44.5);
    expect(firstBegin("one-a")).toBe(10);
    expect(firstBegin("one-b")).toBe(13);
    expect(firstBegin("two-b")).toBe(43);
  });
});
