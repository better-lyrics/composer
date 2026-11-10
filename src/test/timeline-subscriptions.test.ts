import { type ScannedSource, hookCalls, productionSources } from "@/test/source-scan";
import { describe, expect, it } from "vitest";

// Timeline rows and blocks render hundreds of times per song, so one broad store subscription there turns a click,
// a zoom step or a scroll into a re-render of every row.

// -- Interfaces ---------------------------------------------------------------

interface Subscription {
  relPath: string;
  line: number;
  selector: string;
}

// -- Constants ----------------------------------------------------------------

const STORE_HOOK = "useTimelineStore";

const IDENTITY_SELECTOR = /^\(?\s*(\w+)(?:\s*:[^)=]*)?\)?\s*=>\s*\(?\s*\1\s*\)?$/;
const WHOLE_SELECTION_BODY = /^\(?\s*(?:\w+\??\.)?selectedWords\s*\)?$/;
const SELECTED_WORDS = /\bselectedWords\b/;
const SCROLL_POSITION = /\bscroll(?:Left|Top)\b/;
const ZOOM = /\bzoom\b/;

const ROW_COMPONENTS = new Map<string, string>([
  ["views/timeline/line-row.tsx", "one per lyric line"],
  ["views/timeline/line-row-empty-tracks.tsx", "one per untimed track"],
  ["views/timeline/gutter-agent-picker.tsx", "one per line gutter"],
  ["views/timeline/word-track.tsx", "one per main or background track"],
  ["views/timeline/word-block.tsx", "one per word"],
  ["views/timeline/word-edge-handle.tsx", "two per word"],
  ["views/timeline/pitch/pitch-lane.tsx", "one per track while the pitch line shows"],
  ["views/timeline/group-header-row.tsx", "one per group instance"],
  ["views/timeline/group-banner.tsx", "one per group instance"],
]);

const SCROLL_SUBSCRIBERS = new Map<string, string>([
  ["views/timeline/snap-guideline.tsx", "SnapGuidelineAt mounts only while a snap anchor shows"],
  ["views/timeline/loop-region-guides.tsx", "reads 0 unless a loop region shows"],
  ["views/timeline/loop-region-readout.tsx", "reads 0 unless a loop region is being drawn"],
]);

const ZOOM_SUBSCRIBERS = new Map<string, string>([
  ["views/timeline/timeline-rows.tsx", "row layout width"],
  ["views/timeline/word-track.tsx", "word block geometry"],
  ["views/timeline/line-row-empty-tracks.tsx", "empty track width"],
  ["views/timeline/group-header-row.tsx", "banner geometry"],
  ["views/timeline/pitch/pitch-lane.tsx", "lane canvas geometry"],
  ["views/timeline/timeline-waveform.tsx", "waveform host width"],
  ["views/timeline/timeline-ruler.tsx", "tick spacing and label step"],
  ["views/timeline/timeline-header-controls.tsx", "shows the zoom percentage"],
  ["views/timeline/timeline-panel.tsx", "reads zoom only while a drag is active"],
  ["views/timeline/beat-grid/beat-grid-ready.tsx", "grid thinning shown in the popover"],
  ["views/timeline/snap-markers-overlay.tsx", "marker positions and onset coverage"],
  ["views/timeline/snap-guideline.tsx", "guideline position while a snap anchor shows"],
  ["views/timeline/cue-marker.tsx", "cue position"],
  ["views/timeline/loop-region-edges.tsx", "edge hit zones of the loop region"],
  ["views/timeline/loop-region-guides.tsx", "reads 0 unless a loop region shows"],
  ["views/timeline/loop-region-readout.tsx", "reads 0 unless a loop region is being drawn"],
  ["views/timeline/waveform-focus-shade.tsx", "shade geometry while a range shows"],
  ["views/timeline/marquee-selection.tsx", "mounted only while a marquee is drawn"],
  ["views/timeline/paste-preview.tsx", "mounted only while a paste preview shows"],
]);

// -- Helpers ------------------------------------------------------------------

function subscriptionsIn(sources: ScannedSource[]): Subscription[] {
  return sources.flatMap(({ relPath, code }) =>
    hookCalls(code, STORE_HOOK).map(({ line, argument }) => ({ relPath, line, selector: argument })),
  );
}

function selectorBody(selector: string): string {
  const arrow = selector.indexOf("=>");
  return arrow === -1 ? selector : selector.slice(arrow + 2).trim();
}

function readsWholeState({ selector }: Subscription): boolean {
  return selector === "" || IDENTITY_SELECTOR.test(selector);
}

function readsWholeSelection({ selector }: Subscription): boolean {
  if (selector.includes("useShallow") && SELECTED_WORDS.test(selector)) return true;
  return WHOLE_SELECTION_BODY.test(selectorBody(selector));
}

function at({ relPath, line, selector }: Subscription): string {
  return `src/${relPath}:${line} ${STORE_HOOK}(${selector.replace(/\s+/g, " ")})`;
}

function report(offenders: Subscription[], ...guidance: string[]): string {
  return offenders.length === 0 ? "" : [...offenders.map(at), ...guidance].join("\n");
}

function subscribersOf(subscriptions: Subscription[], pattern: RegExp): Set<string> {
  return new Set(subscriptions.filter(({ selector }) => pattern.test(selector)).map(({ relPath }) => relPath));
}

// -- Tests --------------------------------------------------------------------

const timelineSubscriptions = subscriptionsIn(productionSources("views/timeline"));

describe("row-level Timeline components never subscribe to the whole selection", () => {
  it("reads selection through useTrackSelection or a primitive selector", () => {
    const offenders = timelineSubscriptions.filter(
      (subscription) =>
        ROW_COMPONENTS.has(subscription.relPath) &&
        (readsWholeSelection(subscription) || readsWholeState(subscription)),
    );
    expect(
      report(
        offenders,
        "This component renders once per row or per word. Subscribing to selectedWords re-renders all of them on every click.",
        "Use useTrackSelection(lineId, type) (views/timeline/track-selection.ts), or a selector that returns a primitive.",
      ),
    ).toBe("");
  });
});

describe("Timeline fast values are subscribed only where render output uses them", () => {
  const guidance = [
    "zoom, scrollLeft and scrollTop change on every wheel step and scroll frame.",
    "Read them with useTimelineStore.getState() in handlers and frame callbacks; subscribe only when render output",
    "uses the value, gate the selector while the feature is inactive, and add the file with its reason.",
  ];

  it("never subscribes to the whole timeline store", () => {
    expect(report(timelineSubscriptions.filter(readsWholeState), ...guidance)).toBe("");
  });

  it("subscribes to scrollLeft or scrollTop only in the listed files", () => {
    const offenders = timelineSubscriptions.filter(
      ({ relPath, selector }) => SCROLL_POSITION.test(selector) && !SCROLL_SUBSCRIBERS.has(relPath),
    );
    expect(report(offenders, ...guidance)).toBe("");
  });

  it("subscribes to zoom only in the listed files", () => {
    const offenders = timelineSubscriptions.filter(
      ({ relPath, selector }) => ZOOM.test(selector) && !ZOOM_SUBSCRIBERS.has(relPath),
    );
    expect(report(offenders, ...guidance)).toBe("");
  });

  it("lists only files that still subscribe", () => {
    const scroll = subscribersOf(timelineSubscriptions, SCROLL_POSITION);
    const zoom = subscribersOf(timelineSubscriptions, ZOOM);
    expect([...SCROLL_SUBSCRIBERS.keys()].filter((relPath) => !scroll.has(relPath))).toEqual([]);
    expect([...ZOOM_SUBSCRIBERS.keys()].filter((relPath) => !zoom.has(relPath))).toEqual([]);
  });
});
