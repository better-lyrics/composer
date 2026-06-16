import { describe, expect, it } from "vitest";
import { createPlayheadDrag } from "@/views/timeline/playhead-drag";

function buildHarness(snapTime: (time: number, bypass: boolean) => number = (t) => t) {
  const container = document.createElement("div");
  const scrollContainer = document.createElement("div");
  const calls = {
    play: [] as boolean[],
    dragging: [] as boolean[],
    dragTime: [] as number[],
    seek: [] as number[],
    snap: [] as Array<{ time: number; bypass: boolean }>,
  };
  const drag = createPlayheadDrag({
    getContainerRect: () => container.getBoundingClientRect(),
    getScrollContainer: () => scrollContainer,
    getDuration: () => 60,
    getZoom: () => 50,
    getStoreScrollLeft: () => 0,
    getCurrentTime: () => 3,
    setIsPlaying: (v) => calls.play.push(v),
    setDraggingPlayhead: (v) => calls.dragging.push(v),
    setDragTime: (t) => calls.dragTime.push(t),
    seekTo: (t) => calls.seek.push(t),
    snapTime: (time, bypass) => {
      calls.snap.push({ time, bypass });
      return snapTime(time, bypass);
    },
  });
  return { drag, calls };
}

describe("createPlayheadDrag", () => {
  it("pauses playback and enters dragging state on mousedown", () => {
    const { drag, calls } = buildHarness();
    drag.onMouseDown({ button: 0, clientX: 200, preventDefault() {} } as unknown as React.MouseEvent);
    expect(calls.play).toEqual([false]);
    expect(calls.dragging).toEqual([true]);
    drag.dispose();
  });

  it("ignores non-primary mouse buttons", () => {
    const { drag, calls } = buildHarness();
    drag.onMouseDown({ button: 2, clientX: 200, preventDefault() {} } as unknown as React.MouseEvent);
    expect(calls.play).toEqual([]);
    expect(calls.dragging).toEqual([]);
  });

  it("seeks and leaves dragging state on mouseup", () => {
    const { drag, calls } = buildHarness();
    drag.onMouseDown({ button: 0, clientX: 200, preventDefault() {} } as unknown as React.MouseEvent);
    document.dispatchEvent(new MouseEvent("mouseup", { clientX: 200 }));
    expect(calls.seek.length).toBe(1);
    expect(calls.dragging).toEqual([true, false]);
  });

  it("dispose ends an in-flight drag without seeking", () => {
    const { drag, calls } = buildHarness();
    drag.onMouseDown({ button: 0, clientX: 200, preventDefault() {} } as unknown as React.MouseEvent);
    drag.dispose();
    document.dispatchEvent(new MouseEvent("mouseup", { clientX: 200 }));
    expect(calls.seek).toEqual([]);
  });
});

describe("createPlayheadDrag snapping", () => {
  const SENTINEL = 42;

  it("passes the moved time through snapTime before setDragTime", () => {
    const { drag, calls } = buildHarness(() => SENTINEL);
    drag.onMouseDown({ button: 0, clientX: 100, metaKey: false, preventDefault() {} } as unknown as React.MouseEvent);
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 300 }));
    expect(calls.dragTime).toContain(SENTINEL);
    drag.dispose();
  });

  it("passes the released time through snapTime before seekTo", () => {
    const { drag, calls } = buildHarness(() => SENTINEL);
    drag.onMouseDown({ button: 0, clientX: 100, metaKey: false, preventDefault() {} } as unknown as React.MouseEvent);
    document.dispatchEvent(new MouseEvent("mouseup", { clientX: 300 }));
    expect(calls.seek).toContain(SENTINEL);
  });

  it("passes bypass false to snapTime on a plain move", () => {
    const { drag, calls } = buildHarness();
    drag.onMouseDown({ button: 0, clientX: 100, metaKey: false, preventDefault() {} } as unknown as React.MouseEvent);
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 300 }));
    expect(calls.snap.some((c) => c.bypass === false)).toBe(true);
    expect(calls.snap.some((c) => c.bypass === true)).toBe(false);
    drag.dispose();
  });

  it("passes bypass true to snapTime when metaKey is held on move", () => {
    const { drag, calls } = buildHarness();
    drag.onMouseDown({ button: 0, clientX: 100, metaKey: false, preventDefault() {} } as unknown as React.MouseEvent);
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, metaKey: true }));
    expect(calls.snap.some((c) => c.bypass === true)).toBe(true);
    drag.dispose();
  });

  it("passes bypass true to snapTime when metaKey is held on mouseup", () => {
    const { drag, calls } = buildHarness();
    drag.onMouseDown({ button: 0, clientX: 100, metaKey: false, preventDefault() {} } as unknown as React.MouseEvent);
    document.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, metaKey: true }));
    expect(calls.snap.some((c) => c.bypass === true)).toBe(true);
  });

  it("still routes the metaKey-held release through snapTime's return, never the raw time", () => {
    const { drag, calls } = buildHarness(() => SENTINEL);
    drag.onMouseDown({ button: 0, clientX: 100, metaKey: false, preventDefault() {} } as unknown as React.MouseEvent);
    document.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, metaKey: true }));
    expect(calls.seek).toEqual([SENTINEL]);
  });

  it("calls snapTime with the (time, bypass) shape", () => {
    const { drag, calls } = buildHarness();
    drag.onMouseDown({ button: 0, clientX: 100, metaKey: false, preventDefault() {} } as unknown as React.MouseEvent);
    document.dispatchEvent(new MouseEvent("mouseup", { clientX: 300 }));
    expect(calls.snap.length).toBeGreaterThan(0);
    for (const call of calls.snap) {
      expect(typeof call.time).toBe("number");
      expect(typeof call.bypass).toBe("boolean");
    }
  });
});
