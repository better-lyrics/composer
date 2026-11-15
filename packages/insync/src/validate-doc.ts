import type { Doc } from "./doc";
import { type Instance, instanceSlots, isInstanceSpan } from "./group";
import type { LineTrack, LyricLine } from "./line";
import { effectiveBounds } from "./line-bounds";
import { isTimedSyllable } from "./line-track";
import type { PartSection } from "./part";
import { msFromSeconds } from "./time";
import { type TrackRule, validateTrack } from "./validate-track";
import type { Bounds } from "./word-bounds";

// -- Types --------------------------------------------------------------------

type DocRule =
  | TrackRule
  | "duplicate-id"
  | "duplicate-line-id"
  | "track-order"
  | "span-and-syllable-times"
  | "unknown-agent"
  | "unknown-group"
  | "unknown-instance"
  | "unknown-slot"
  | "unknown-line"
  | "out-of-song";

interface DocFinding {
  // The node the finding is about: `line <id>`, `template <group>:<slot>`, `body <key>`, `instance <key>`, ...
  node: string;
  rule: DocRule;
}

interface DocReport {
  errors: DocFinding[];
  warnings: DocFinding[];
}

interface DocValidationOptions {
  // Flattened instances are checked against it only when the song end is known.
  songEnd?: number;
}

// Imported files bring these in and they are kept, so they never refuse a doc.
const IMPORTED_SPAN_RULES = new Set<TrackRule>(["begin-after-end", "overlaps-previous"]);

// -- Lines --------------------------------------------------------------------

function trackSpanRules(track: LineTrack): TrackRule[] {
  if (track.begin === undefined) return [];
  if (!Number.isFinite(track.begin) || !Number.isFinite(track.end)) return ["non-finite-time"];
  return [
    ...(track.begin < 0 ? ["negative-begin" as const] : []),
    ...(track.begin > track.end ? ["begin-after-end" as const] : []),
  ];
}

function trackRules(track: LineTrack): TrackRule[] {
  const report = validateTrack(
    track.syllables.map((syllable) => ({
      text: syllable.text,
      sep: syllable.sep,
      joinsNext: syllable.joinsNext,
      ...(isTimedSyllable(syllable) && { span: [msFromSeconds(syllable.begin), msFromSeconds(syllable.end)] as const }),
    })),
  );
  return [...trackSpanRules(track), ...[...report.errors, ...report.warnings].map(({ rule }) => rule)];
}

function lineFindings(line: LyricLine, node: string, agentIds: ReadonlySet<string>, report: DocReport): void {
  const ids = new Set<string>();
  const fail = (rule: DocRule) => report.errors.push({ node, rule });
  for (const id of [
    ...line.tracks.map((track) => track.id),
    ...line.tracks.flatMap((track) => track.syllables.map((syllable) => syllable.id)),
  ]) {
    if (ids.has(id)) fail("duplicate-id");
    ids.add(id);
  }
  line.tracks.forEach((track, index) => {
    if (track.role !== (index === 0 ? "main" : "bg") || index > 1) fail("track-order");
    if (track.begin !== undefined && track.syllables.some(isTimedSyllable)) fail("span-and-syllable-times");
    for (const rule of trackRules(track))
      (IMPORTED_SPAN_RULES.has(rule) ? report.warnings : report.errors).push({ node, rule });
    if (track.role === "main" && !agentIds.has(track.agentId)) fail("unknown-agent");
  });
}

// -- Instances ----------------------------------------------------------------

function joinedBounds(all: readonly (Bounds | null)[]): Bounds | null {
  const known = all.filter((bounds) => bounds !== null);
  if (known.length === 0) return null;
  return { begin: Math.min(...known.map(({ begin }) => begin)), end: Math.max(...known.map(({ end }) => end)) };
}

// Where an instance lands once flattened: its own times, or the template placed at its anchor, and its replaced lines.
function flattenedBounds(instance: Instance, doc: Doc): Bounds | null {
  const slots = instanceSlots(instance);
  const replaced = slots.map((slot) => instance.replaced?.[slot]).filter((line) => line !== undefined);
  const own = instance.ownTiming && [
    ...Object.values(instance.ownTiming.syllables),
    ...Object.values(instance.ownTiming.tracks ?? {}),
  ];
  const at = instance.at;
  const fromTemplate = own
    ? own.map(([begin, end]) => ({ begin, end }))
    : at === undefined
      ? []
      : (doc.templates[instance.groupId] ?? [])
          .filter((line) => slots.includes(line.slot) && !instance.replaced?.[line.slot])
          .map((line) => effectiveBounds(line))
          .map((bounds) => bounds && { begin: bounds.begin + at, end: bounds.end + at });
  return joinedBounds([...fromTemplate, ...replaced.map(effectiveBounds)]);
}

function instanceFindings(
  key: string,
  instance: Instance,
  doc: Doc,
  songEnd: number | undefined,
  report: DocReport,
): void {
  const node = `instance ${key}`;
  if (!doc.groups.some((group) => group.id === instance.groupId)) report.errors.push({ node, rule: "unknown-group" });
  const bounds = songEnd === undefined ? null : flattenedBounds(instance, doc);
  if (songEnd !== undefined && bounds && (bounds.begin < 0 || msFromSeconds(bounds.end) > msFromSeconds(songEnd))) {
    report.errors.push({ node, rule: "out-of-song" });
  }
}

// -- Validation ---------------------------------------------------------------

function sectionLineIds(section: PartSection): string[] {
  return [...section.lineIds, ...(section.sections ?? []).flatMap(sectionLineIds)];
}

// Unique ids, the track span rule, ordered spans (as warnings), flattened instances inside the song when its end is
// known, and references that resolve.
function validateDoc(doc: Doc, { songEnd }: DocValidationOptions = {}): DocReport {
  const report: DocReport = { errors: [], warnings: [] };
  const agentIds = new Set(doc.agents.map((agent) => agent.id));
  const groupIds = new Set(doc.groups.map((group) => group.id));
  const lineIds = new Set<string>();
  const seeLineId = (id: string, node: string) => {
    if (lineIds.has(id)) report.errors.push({ node, rule: "duplicate-line-id" });
    lineIds.add(id);
  };
  for (const item of doc.body) {
    if (isInstanceSpan(item)) {
      const instance = doc.instances[item.key];
      const node = `body ${item.key}`;
      if (!instance) report.errors.push({ node, rule: "unknown-instance" });
      else if (item.slots.some((slot) => instance.lineIds[slot] === undefined))
        report.errors.push({ node, rule: "unknown-slot" });
      continue;
    }
    const node = `line ${item.id}`;
    lineFindings(item, node, agentIds, report);
    seeLineId(item.id, node);
    if (item.groupId !== undefined && !groupIds.has(item.groupId)) report.errors.push({ node, rule: "unknown-group" });
  }
  for (const [groupId, template] of Object.entries(doc.templates)) {
    if (!groupIds.has(groupId)) report.errors.push({ node: `template ${groupId}`, rule: "unknown-group" });
    for (const line of template) lineFindings(line, `template ${groupId}:${line.slot}`, agentIds, report);
  }
  for (const [key, instance] of Object.entries(doc.instances)) {
    for (const id of Object.values(instance.lineIds)) seeLineId(id, `instance ${key}`);
    for (const [slot, line] of Object.entries(instance.replaced ?? {}))
      lineFindings(line, `instance ${key}:${slot}`, agentIds, report);
    instanceFindings(key, instance, doc, songEnd, report);
  }
  for (const part of doc.parts) {
    if (sectionLineIds(part).some((id) => !lineIds.has(id)))
      report.errors.push({ node: `part ${part.id}`, rule: "unknown-line" });
  }
  return report;
}

// -- Exports ------------------------------------------------------------------

export type { DocFinding, DocReport, DocRule, DocValidationOptions };
export { validateDoc };
