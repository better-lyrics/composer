import type { LyricLine } from "./line";

// -- Types --------------------------------------------------------------------

interface LinkGroup {
  id: string;
  label: string;
  color: string;
  templateVersion: number;
  sharesTiming?: true;
  ownTimingInstances?: number[];
}

type SpanTimes = readonly [number, number];

// A group's line once, with times relative to the anchor of the instance it came from. `id` is the line it was taken
// from, so ids made from that line's id (tracks, line-synced words) are made again for each instance.
type TemplateLine = Omit<LyricLine, "groupId" | "instanceIdx" | "templateLineIdx" | "detached"> & {
  readonly slot: number;
};

// Absolute times of an instance that keeps its own timing, by template syllable and track id. A template syllable
// missing from it is untimed in that instance.
interface OwnTiming {
  readonly syllables: Readonly<Record<string, SpanTimes>>;
  readonly tracks?: Readonly<Record<string, SpanTimes>>;
}

// One instance of a group: what the template gives it and what it holds itself. Where its lines sit is the body's.
interface Instance {
  readonly groupId: string;
  readonly idx: number;
  // Present: the instance is its template placed here. Absent with no own timing: the template untimed.
  readonly at?: number;
  readonly ownTiming?: OwnTiming;
  readonly lineIds: Readonly<Record<number, string>>;
  // Template id to this instance's id, for ids the instance had before it was read from flat lines.
  readonly ids?: Readonly<Record<number, Readonly<Record<string, string>>>>;
  // Lines the template does not give this instance: detached lines, and lines whose content differs.
  readonly replaced?: Readonly<Record<number, LyricLine>>;
}

// Consecutive lines of one instance, in the order they sit. An instance with a line between its own lines, or with its
// lines out of slot order, has several spans.
interface InstanceSpan {
  readonly kind: "instance";
  readonly key: string;
  readonly slots: readonly number[];
}

// A plain line, an instance span, or a group line that repeats a slot its instance already has.
type BodyItem = LyricLine | InstanceSpan;

interface LyricDoc {
  readonly body: readonly BodyItem[];
  readonly instances: Readonly<Record<string, Instance>>;
  readonly templates: Readonly<Record<string, readonly TemplateLine[]>>;
}

// -- Functions ----------------------------------------------------------------

function isInstanceSpan(item: BodyItem): item is InstanceSpan {
  return "kind" in item && item.kind === "instance";
}

function instanceSlots(instance: Instance): number[] {
  return Object.keys(instance.lineIds)
    .map(Number)
    .toSorted((a, b) => a - b);
}

// -- Exports ------------------------------------------------------------------

export type { BodyItem, Instance, InstanceSpan, LinkGroup, LyricDoc, OwnTiming, SpanTimes, TemplateLine };
export { instanceSlots, isInstanceSpan };
