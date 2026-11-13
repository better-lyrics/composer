import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import {
  installScrollHost,
  makeCursorTargetingEvent,
  makeCursorTargetingStartEvent,
} from "@/views/timeline/use-timeline-dnd.test-helpers";

interface FlowOptions {
  lineId: string;
  lineIndex: number;
  wordIndex: number;
  trackType: "word" | "bg";
  text: string;
  begin: number;
  end: number;
  pointerX: number;
  pointerY: number;
  deltaX: number;
  deltaY: number;
}

async function runDragFlow(hookResult: { current: ReturnType<typeof useTimelineDnd> }, opts: FlowOptions) {
  hookResult.current.handleDragStart(makeCursorTargetingStartEvent(opts));
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: opts.pointerX, clientY: opts.pointerY }));
  hookResult.current.handleDragEnd(makeCursorTargetingEvent(opts));
}

describe("useTimelineDnd · cross-line and reliable track switch", () => {
  let scrollHost: HTMLDivElement;

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    scrollHost = installScrollHost();
  });

  afterEach(() => {
    scrollHost.remove();
  });

  it("drops a main word into the same line's empty bg zone reliably even when cursor x stays put", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "hello world",
          agentId: "v1",
          words: [
            { id: "w1", text: "hello", sep: " ", begin: 0.1, end: 0.5, joinsNext: false },
            { id: "w2", text: "world", sep: "", begin: 0.5, end: 0.9, joinsNext: false },
          ],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    await runDragFlow(result, {
      lineId: "l1",
      lineIndex: 0,
      wordIndex: 1,
      trackType: "word",
      text: "world",
      begin: 0.5,
      end: 0.9,
      pointerX: 100,
      pointerY: 135,
      deltaX: 0,
      deltaY: 30,
    });

    const after = useProjectStore.getState().lines[0];
    expect(after.words?.length).toBe(1);
    expect(after.backgroundWords?.length).toBe(1);
    expect(timedSyllables(backgroundTrack(after))[0].text.trim()).toBe("world");
  });

  it("drops a bg word back into the same line's main zone reliably", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "hello",
          agentId: "v1",
          words: [{ id: "w4", text: "hello", sep: "", begin: 0.1, end: 0.4, joinsNext: false }],
          backgroundText: "ooh aah",
          backgroundWords: [
            { id: "w5", text: "ooh", sep: " ", begin: 1.0, end: 1.4, joinsNext: false },
            { id: "w6", text: "aah", sep: "", begin: 1.5, end: 1.9, joinsNext: false },
          ],
          backgroundTextSource: "manual",
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    await runDragFlow(result, {
      lineId: "l1",
      lineIndex: 0,
      wordIndex: 1,
      trackType: "bg",
      text: "aah",
      begin: 1.5,
      end: 1.9,
      pointerX: 200,
      pointerY: 100,
      deltaX: 0,
      deltaY: -50,
    });

    const after = useProjectStore.getState().lines[0];
    expect(after.words?.length).toBe(2);
    expect(after.backgroundWords?.length).toBe(1);
    expect(after.words?.some((w) => w.text.trim() === "aah")).toBe(true);
  });

  it("drops a main word from line A into line B's main track", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          words: [
            { id: "w8", text: "alpha", sep: " ", begin: 0.1, end: 0.4, joinsNext: false },
            { id: "w9", text: "beta", sep: "", begin: 0.4, end: 0.7, joinsNext: false },
          ],
        },
        {
          id: "lB",
          text: "delta",
          agentId: "v1",
          words: [{ id: "w10", text: "delta", sep: "", begin: 5.0, end: 5.4, joinsNext: false }],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    await runDragFlow(result, {
      lineId: "lA",
      lineIndex: 0,
      wordIndex: 0,
      trackType: "word",
      text: "alpha",
      begin: 0.1,
      end: 0.4,
      pointerX: 200,
      pointerY: 170,
      deltaX: 600,
      deltaY: 60,
    });

    const after = useProjectStore.getState().lines;
    const a = after.find((l) => l.id === "lA");
    const b = after.find((l) => l.id === "lB");
    expect(a?.words?.length).toBe(1);
    expect(b?.words?.some((w) => w.text.trim() === "alpha")).toBe(true);
  });

  it("drops a main word from line A into line B's bg track", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          words: [
            { id: "w12", text: "alpha", sep: " ", begin: 0.1, end: 0.4, joinsNext: false },
            { id: "w13", text: "beta", sep: "", begin: 0.4, end: 0.7, joinsNext: false },
          ],
        },
        {
          id: "lB",
          text: "delta",
          agentId: "v1",
          words: [{ id: "w14", text: "delta", sep: "", begin: 5.0, end: 5.4, joinsNext: false }],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    await runDragFlow(result, {
      lineId: "lA",
      lineIndex: 0,
      wordIndex: 0,
      trackType: "word",
      text: "alpha",
      begin: 0.1,
      end: 0.4,
      pointerX: 200,
      pointerY: 200,
      deltaX: 1000,
      deltaY: 110,
    });

    const after = useProjectStore.getState().lines;
    const a = after.find((l) => l.id === "lA");
    const b = after.find((l) => l.id === "lB");
    expect(a?.words?.length).toBe(1);
    expect(b?.backgroundWords?.some((w) => w.text.trim() === "alpha")).toBe(true);
  });

  it("rejects with a toast on cross-instance attempts and leaves both lines untouched", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          words: [
            { id: "w16", text: "alpha", sep: " ", begin: 0.1, end: 0.4, joinsNext: false },
            { id: "w17", text: "beta", sep: "", begin: 0.4, end: 0.7, joinsNext: false },
          ],
        },
        {
          id: "lB",
          text: "delta",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          words: [{ id: "w18", text: "delta", sep: "", begin: 5.0, end: 5.4, joinsNext: false }],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const before = lines.map((l) => l.words?.map((w) => w.text + w.sep).join("|"));
    const baseline = toast.getHistory().length;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    await runDragFlow(result, {
      lineId: "lA",
      lineIndex: 0,
      wordIndex: 0,
      trackType: "word",
      text: "alpha",
      begin: 0.1,
      end: 0.4,
      pointerX: 200,
      pointerY: 240,
      deltaX: 600,
      deltaY: 0,
    });

    const after = useProjectStore.getState().lines.map((l) => l.words?.map((w) => w.text + w.sep).join("|"));
    expect(after).toEqual(before);
    const fired = toast.getHistory().slice(baseline);
    expect(fired.some((t) => "title" in t && /Detach the line first/.test(String(t.title)))).toBe(true);
  });

  it("rejects with a toast when target line is line-synced and leaves data untouched", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          words: [
            { id: "w20", text: "alpha", sep: " ", begin: 0.1, end: 0.4, joinsNext: false },
            { id: "w21", text: "beta", sep: "", begin: 0.4, end: 0.7, joinsNext: false },
          ],
        },
        {
          id: "lB",
          text: "delta",
          agentId: "v1",
          begin: 5.0,
          end: 5.4,
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const baseline = toast.getHistory().length;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    await runDragFlow(result, {
      lineId: "lA",
      lineIndex: 0,
      wordIndex: 0,
      trackType: "word",
      text: "alpha",
      begin: 0.1,
      end: 0.4,
      pointerX: 200,
      pointerY: 170,
      deltaX: 600,
      deltaY: 60,
    });

    const after = useProjectStore.getState().lines;
    expect(after.find((l) => l.id === "lA")?.words?.length).toBe(2);
    expect(after.find((l) => l.id === "lB")?.words).toBeUndefined();
    const fired = toast.getHistory().slice(baseline);
    expect(fired.some((t) => "title" in t && /Sync this line into words first/.test(String(t.title)))).toBe(true);
  });

  it("rejects an overlap with a toast and leaves both lines untouched", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          words: [
            { id: "w23", text: "alpha", sep: " ", begin: 0.1, end: 0.4, joinsNext: false },
            { id: "w24", text: "beta", sep: "", begin: 0.4, end: 0.7, joinsNext: false },
          ],
        },
        {
          id: "lB",
          text: "delta",
          agentId: "v1",
          words: [{ id: "w25", text: "delta", sep: "", begin: 6.0, end: 6.6, joinsNext: false }],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const before = JSON.stringify(lines);
    const baseline = toast.getHistory().length;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    await runDragFlow(result, {
      lineId: "lA",
      lineIndex: 0,
      wordIndex: 0,
      trackType: "word",
      text: "alpha",
      begin: 0.1,
      end: 0.4,
      pointerX: 200,
      pointerY: 160,
      deltaX: 595,
      deltaY: 0,
    });

    const after = JSON.stringify(useProjectStore.getState().lines);
    expect(after).toEqual(before);
    const fired = toast.getHistory().slice(baseline);
    expect(fired.some((t) => "title" in t && /Drop into a gap/.test(String(t.title)))).toBe(true);
  });

  it("no-ops when cursor falls outside any row on drop", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "hello world",
          agentId: "v1",
          words: [
            { id: "w27", text: "hello", sep: " ", begin: 0.1, end: 0.5, joinsNext: false },
            { id: "w28", text: "world", sep: "", begin: 0.5, end: 0.9, joinsNext: false },
          ],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const before = JSON.stringify(lines);
    const { result } = await renderHook(() => useTimelineDnd(lines));

    await runDragFlow(result, {
      lineId: "l1",
      lineIndex: 0,
      wordIndex: 0,
      trackType: "word",
      text: "hello",
      begin: 0.1,
      end: 0.5,
      pointerX: 200,
      pointerY: 900,
      deltaX: 0,
      deltaY: 0,
    });

    const after = JSON.stringify(useProjectStore.getState().lines);
    expect(after).toEqual(before);
  });

  it("switches track when the cursor lands in the bg zone even with only a few pixels of delta.y", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "hello",
          agentId: "v1",
          words: [{ id: "w30", text: "hello", sep: "", begin: 0.1, end: 0.4, joinsNext: false }],
          backgroundText: "ooh",
          backgroundWords: [{ id: "w31", text: "ooh", sep: "", begin: 1.0, end: 1.4, joinsNext: false }],
          backgroundTextSource: "manual",
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    await runDragFlow(result, {
      lineId: "l1",
      lineIndex: 0,
      wordIndex: 0,
      trackType: "word",
      text: "hello",
      begin: 0.1,
      end: 0.4,
      pointerX: 100,
      pointerY: 125,
      deltaX: 0,
      deltaY: 5,
    });

    const after = useProjectStore.getState().lines[0];
    expect(timedSyllables(mainTrack(after)).length).toBe(0);
    expect(after.backgroundWords?.length).toBe(2);
  });

  it("uses live cursor position over container scrollTop, so auto-scroll during drag doesn't shift the drop target", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          words: [
            { id: "w33", text: "alpha", sep: " ", begin: 0.1, end: 0.4, joinsNext: false },
            { id: "w34", text: "beta", sep: "", begin: 0.4, end: 0.7, joinsNext: false },
          ],
        },
        {
          id: "lB",
          text: "delta",
          agentId: "v1",
          words: [{ id: "w35", text: "delta", sep: "", begin: 5.0, end: 5.4, joinsNext: false }],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragStart(
      makeCursorTargetingStartEvent({
        lineId: "lA",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "alpha",
        begin: 0.1,
        end: 0.4,
        pointerX: 200,
        pointerY: 100,
      }),
    );

    // Auto-scroll moved the container down 80px while the user's visible
    // cursor stayed put. clientY remains the viewport coordinate. Two-line
    // layout: waveform ends at 81, line A row 81..150, line B row 150..219.
    // Container-content Y = (clientY - rect.top) + scrollTop = 100 + 80 = 180,
    // which lands inside line B's main half. If the math double-counted
    // scrollTop, cursorY would be 100 + 80 + 80 = 260, past every row, no-op.
    Object.defineProperty(scrollHost, "scrollTop", { configurable: true, value: 80, writable: true });
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 200, clientY: 100 }));

    result.current.handleDragEnd(
      makeCursorTargetingEvent({
        lineId: "lA",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "alpha",
        begin: 0.1,
        end: 0.4,
        pointerX: 200,
        pointerY: 100,
        deltaX: 600,
        deltaY: 0,
      }),
    );

    const after = useProjectStore.getState().lines;
    const b = after.find((l) => l.id === "lB");
    expect(b?.words?.some((w) => w.text.trim() === "alpha")).toBe(true);
  });

  describe("sibling propagation parity for cross-track moves", () => {
    it("does not propagate to linked sibling when toggling main to bg same-line on a linked instance", async () => {
      useProjectStore.setState({
        lines: [
          {
            id: "a0",
            text: "alpha beta",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 0,
            words: [
              { id: "w38", text: "alpha", sep: " ", begin: 0.1, end: 0.4, joinsNext: false },
              { id: "w39", text: "beta", sep: "", begin: 0.4, end: 0.7, joinsNext: false },
            ],
          },
          {
            id: "a1",
            text: "alpha beta",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 1,
            words: [
              { id: "w40", text: "alpha", sep: " ", begin: 5.1, end: 5.4, joinsNext: false },
              { id: "w41", text: "beta", sep: "", begin: 5.4, end: 5.7, joinsNext: false },
            ],
          },
        ],
      });
      const lines = useProjectStore.getState().lines;
      const siblingBefore = JSON.stringify(lines[1]);
      const { result } = await renderHook(() => useTimelineDnd(lines));

      await runDragFlow(result, {
        lineId: "a0",
        lineIndex: 0,
        wordIndex: 1,
        trackType: "word",
        text: "beta",
        begin: 0.4,
        end: 0.7,
        pointerX: 200,
        pointerY: 170,
        deltaX: 0,
        deltaY: 30,
      });

      const after = useProjectStore.getState().lines;
      const source = after.find((l) => l.id === "a0");
      const sibling = after.find((l) => l.id === "a1");
      expect(source?.words?.length).toBe(1);
      expect(source?.backgroundWords?.length).toBe(1);
      expect(JSON.stringify(sibling)).toBe(siblingBefore);
    });

    it("does not propagate to linked sibling when moving across lines in a linked instance", async () => {
      useProjectStore.setState({
        lines: [
          {
            id: "a0",
            text: "alpha beta",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 0,
            words: [
              { id: "w43", text: "alpha", sep: " ", begin: 0.1, end: 0.4, joinsNext: false },
              { id: "w44", text: "beta", sep: "", begin: 0.4, end: 0.7, joinsNext: false },
            ],
          },
          {
            id: "a1",
            text: "gamma delta",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 0,
            words: [
              { id: "w45", text: "gamma", sep: " ", begin: 1.0, end: 1.4, joinsNext: false },
              { id: "w46", text: "delta", sep: "", begin: 1.4, end: 1.7, joinsNext: false },
            ],
          },
          {
            id: "b0",
            text: "alpha beta",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 1,
            words: [
              { id: "w47", text: "alpha", sep: " ", begin: 10.1, end: 10.4, joinsNext: false },
              { id: "w48", text: "beta", sep: "", begin: 10.4, end: 10.7, joinsNext: false },
            ],
          },
          {
            id: "b1",
            text: "gamma delta",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 1,
            words: [
              { id: "w49", text: "gamma", sep: " ", begin: 11.0, end: 11.4, joinsNext: false },
              { id: "w50", text: "delta", sep: "", begin: 11.4, end: 11.7, joinsNext: false },
            ],
          },
        ],
      });
      const lines = useProjectStore.getState().lines;
      const b0Before = JSON.stringify(lines.find((l) => l.id === "b0"));
      const b1Before = JSON.stringify(lines.find((l) => l.id === "b1"));
      const { result } = await renderHook(() => useTimelineDnd(lines));

      await runDragFlow(result, {
        lineId: "a0",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "alpha",
        begin: 0.1,
        end: 0.4,
        pointerX: 200,
        pointerY: 210,
        deltaX: 250,
        deltaY: 40,
      });

      const after = useProjectStore.getState().lines;
      const a0After = after.find((l) => l.id === "a0");
      const a1After = after.find((l) => l.id === "a1");
      expect(a0After?.words?.length).toBe(1);
      expect(a1After?.words?.some((w) => w.text.trim() === "alpha")).toBe(true);

      const b0After = JSON.stringify(after.find((l) => l.id === "b0"));
      const b1After = JSON.stringify(after.find((l) => l.id === "b1"));
      expect(b0After).toBe(b0Before);
      expect(b1After).toBe(b1Before);
    });
  });
});
