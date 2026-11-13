import { getEffectiveLines } from "@/domain/line/effective-words";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { storedWordAddress } from "@/test/word-address";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import { installScrollHost, makeAltDuplicateEvent } from "@/views/timeline/use-timeline-dnd.test-helpers";
import { useTimelineKeyboard } from "@/views/timeline/use-timeline-keyboard";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

const LINE_SYNCED = { id: "ls", text: "Line synced only", agentId: "v1", begin: 17, end: 20 };

describe("effective line write-back", () => {
  it("insert-line shortcut (N) leaves other line-synced lines line-synced", async () => {
    useAudioStore.setState({ duration: 30 });
    useProjectStore.setState({
      activeTab: "timeline",
      lines: [
        {
          id: "w",
          text: "hi",
          agentId: "v1",
          words: [{ id: "w1", text: "hi", sep: "", begin: 0, end: 1, joinsNext: false }],
        },
        LINE_SYNCED,
      ],
    });
    useTimelineStore.setState({ selectedWords: [storedWordAddress("w", 0, "word")] });
    const lines = getEffectiveLines(useProjectStore.getState().lines);
    await renderHook(() => useTimelineKeyboard(createRef<HTMLDivElement | null>(), lines, 30));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
    const after = useProjectStore.getState().lines;
    expect(after).toHaveLength(3);
    expect(after.find((l) => l.id === "ls")).toEqual(LINE_SYNCED);
  });

  it("Alt-drag duplicate of a line-synced block does not convert it to word timing", async () => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, selectedWords: [] });
    const host = installScrollHost();
    useProjectStore.setState({ lines: [{ ...LINE_SYNCED, id: "l1" }] });
    const lines = getEffectiveLines(useProjectStore.getState().lines);
    const { result } = await renderHook(() => useTimelineDnd(lines));
    result.current.handleDragEnd(makeAltDuplicateEvent(0, 500));
    const after = useProjectStore.getState().lines[0];
    host.remove();
    expect(after.words).toBeUndefined();
  });

  it("'[' set-begin-to-playhead on a selected line-synced block keeps it line-synced", async () => {
    useAudioStore.setState({ duration: 30, currentTime: 18 });
    useProjectStore.setState({ activeTab: "timeline", lines: [LINE_SYNCED] });
    useSettingsStore.setState({ rollingEdit: false });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress("ls", 0, "word")],
    });
    const lines = getEffectiveLines(useProjectStore.getState().lines);
    await renderHook(() => useTimelineKeyboard(createRef<HTMLDivElement | null>(), lines, 30));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "[", bubbles: true }));
    const after = useProjectStore.getState().lines[0];
    expect(after.words).toBeUndefined();
    expect(after.begin).toBe(18);
  });
});
