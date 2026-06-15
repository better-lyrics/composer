import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

// -- Constants -----------------------------------------------------------------

// Row 0 main track sits at y ~100 with default row height 44 and waveform 81.
// Picking 100 lands inside the main half; 130 lands inside the bg drop zone.
const POINTER_Y_MAIN = 100;
const POINTER_Y_BG = 130;

// -- DOM scroll host -----------------------------------------------------------

function installScrollHost(): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("data-scroll-container", "");
  Object.defineProperty(host, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      top: 0,
      left: 0,
      right: 1000,
      bottom: 1000,
      width: 1000,
      height: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  Object.defineProperty(host, "scrollLeft", { configurable: true, value: 0, writable: true });
  Object.defineProperty(host, "scrollTop", { configurable: true, value: 0, writable: true });
  document.body.appendChild(host);
  return host;
}

// -- Drag data ----------------------------------------------------------------

interface DragWordData {
  lineId: string;
  lineIndex: number;
  wordIndex: number;
  trackType: "word" | "bg";
  text: string;
  begin: number;
  end: number;
}

function activeOf(data: DragWordData) {
  return {
    id: "w",
    data: { current: data },
    rect: { current: { initial: null, translated: null } },
  };
}

function overOf(id: string, lineId: string) {
  return {
    id,
    data: { current: { lineId } },
    rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
    disabled: false,
  };
}

// -- Live-shift drag event factories ------------------------------------------

const L1_WORD_1: DragWordData = {
  lineId: "l1",
  lineIndex: 0,
  wordIndex: 1,
  trackType: "word",
  text: "er",
  begin: 0.3,
  end: 0.6,
};

function makeDragStartEvent(shiftKey: boolean): DragStartEvent {
  return {
    active: activeOf(L1_WORD_1),
    activatorEvent: new PointerEvent("pointerdown", { shiftKey, clientX: 0, clientY: 0 }),
  } as unknown as DragStartEvent;
}

interface DragEndOptions {
  overId: string;
  deltaY: number;
  activatorShift: boolean;
  deltaX?: number;
  pointerY?: number;
  pointerX?: number;
}

function makeDragEndEvent({
  overId,
  deltaY,
  activatorShift,
  deltaX = 5,
  pointerY = POINTER_Y_MAIN,
  pointerX = 200,
}: DragEndOptions): DragEndEvent {
  return {
    active: activeOf(L1_WORD_1),
    over: overOf(overId, "l1"),
    delta: { x: deltaX, y: deltaY },
    activatorEvent: new PointerEvent("pointerdown", { shiftKey: activatorShift, clientX: pointerX, clientY: pointerY }),
    collisions: null,
  } as unknown as DragEndEvent;
}

// -- Alt-duplicate factory ----------------------------------------------------

function makeAltDuplicateEvent(wordIndex: number, deltaX: number): DragEndEvent {
  return {
    active: activeOf({ lineId: "l1", lineIndex: 0, wordIndex, trackType: "word", text: "", begin: 0, end: 0 }),
    delta: { x: deltaX, y: 0 },
    activatorEvent: new PointerEvent("pointerdown", { altKey: true }),
    collisions: null,
  } as unknown as DragEndEvent;
}

// -- Within-track reorder factories -------------------------------------------

const REORDER_WORD: DragWordData = {
  lineId: "l1",
  lineIndex: 0,
  wordIndex: 2,
  trackType: "word",
  text: "word3",
  begin: 2,
  end: 2.5,
};

function makeReorderDragStartEvent(): DragStartEvent {
  return {
    active: activeOf(REORDER_WORD),
    activatorEvent: new PointerEvent("pointerdown", { shiftKey: false, clientX: 400, clientY: POINTER_Y_MAIN }),
  } as unknown as DragStartEvent;
}

function makeReorderDragEndEvent(): DragEndEvent {
  return {
    active: activeOf(REORDER_WORD),
    over: overOf("main-drop-l1", "l1"),
    delta: { x: -150, y: 0 },
    activatorEvent: new PointerEvent("pointerdown", { shiftKey: false, clientX: 400, clientY: POINTER_Y_MAIN }),
    collisions: null,
  } as unknown as DragEndEvent;
}

// -- Background-reorder factory -----------------------------------------------

const BG_WORD: DragWordData = {
  lineId: "l1",
  lineIndex: 0,
  wordIndex: 1,
  trackType: "bg",
  text: "aah",
  begin: 1,
  end: 1.5,
};

function makeBgReorderDragStartEvent(): DragStartEvent {
  return {
    active: activeOf(BG_WORD),
    activatorEvent: new PointerEvent("pointerdown", { shiftKey: false, clientX: 300, clientY: 140 }),
  } as unknown as DragStartEvent;
}

function makeBgReorderDragEndEvent(deltaX: number): DragEndEvent {
  return {
    active: activeOf(BG_WORD),
    over: overOf("bg-drop-l1", "l1"),
    delta: { x: deltaX, y: 0 },
    activatorEvent: new PointerEvent("pointerdown", { shiftKey: false, clientX: 300, clientY: 140 }),
    collisions: null,
  } as unknown as DragEndEvent;
}

// -- Cursor-targeting factory -------------------------------------------------

interface CursorTargetingOptions extends DragWordData {
  pointerX: number;
  pointerY: number;
  deltaX: number;
  deltaY: number;
}

function makeCursorTargetingEvent(opts: CursorTargetingOptions): DragEndEvent {
  const { pointerX, pointerY, deltaX, deltaY, ...data } = opts;
  return {
    active: activeOf(data),
    over: overOf(`main-drop-${data.lineId}`, data.lineId),
    delta: { x: deltaX, y: deltaY },
    activatorEvent: new PointerEvent("pointerdown", { clientX: pointerX, clientY: pointerY }),
    collisions: null,
  } as unknown as DragEndEvent;
}

interface CursorTargetingStartOptions extends DragWordData {
  pointerX: number;
  pointerY: number;
}

function makeCursorTargetingStartEvent(opts: CursorTargetingStartOptions): DragStartEvent {
  const { pointerX, pointerY, ...data } = opts;
  return {
    active: activeOf(data),
    activatorEvent: new PointerEvent("pointerdown", { clientX: pointerX, clientY: pointerY }),
  } as unknown as DragStartEvent;
}

// -- Exports -------------------------------------------------------------------

export {
  POINTER_Y_BG,
  POINTER_Y_MAIN,
  installScrollHost,
  makeAltDuplicateEvent,
  makeBgReorderDragEndEvent,
  makeBgReorderDragStartEvent,
  makeCursorTargetingEvent,
  makeCursorTargetingStartEvent,
  makeDragEndEvent,
  makeDragStartEvent,
  makeReorderDragEndEvent,
  makeReorderDragStartEvent,
};
export type { CursorTargetingOptions, CursorTargetingStartOptions, DragEndOptions };
