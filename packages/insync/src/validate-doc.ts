import type { Doc } from "./doc";
import { type Instance, isInstanceSpan, type TemplateLine } from "./group";
import type { LineTrack, LyricLine, Syllable } from "./line";
import { ownTimedTrack, retimedTrack, untimedTrack } from "./group-template-line";
import { isTimedSyllable } from "./line-track";
import type { PartSection } from "./part";
import { msFromSeconds } from "./time";
import { isWarningRule, type TrackRule, validateTrack } from "./validate-track";

// -- Types --------------------------------------------------------------------

type DocRule =
  | TrackRule
  | "duplicate-id"
  | "duplicate-line-id"
  | "duplicate-slot"
  | "track-order"
  | "span-and-syllable-times"
  | "unknown-agent"
  | "unknown-group"
  | "unknown-instance"
  | "unknown-slot"
  | "unknown-template-line"
  | "unknown-line"
  | "out-of-song";

interface DocFinding {
  // The node the finding is about: `line <id>`, `template <group>:<slot>`, `body <key>`, `instance <key>:<slot>`, ...
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

type Span = readonly [number, number];

// A track's times as one line holds them: stored on a plain line, or placed by an instance on a template line.
interface TrackTimes {
  span?: Span;
  syllables: readonly { text: string; sep: string; joinsNext: boolean; span?: Span }[];
}

// -- Constants ----------------------------------------------------------------

// Template times are relative to the anchor, so these are checked only where an instance places them.
const TIME_RULES = new Set<TrackRule>(["non-finite-time", "negative-begin", "begin-after-end", "overlaps-previous"]);

// -- Times --------------------------------------------------------------------

function syllableParts({ text, sep, joinsNext }: Syllable) {
  return { text, sep, joinsNext };
}

function storedTimes(track: LineTrack): TrackTimes {
  return {
    ...(track.begin !== undefined && { span: [track.begin, track.end] }),
    syllables: track.syllables.map((syllable: Syllable) => ({
      ...syllableParts(syllable),
      ...(isTimedSyllable(syllable) && { span: [syllable.begin, syllable.end] as const }),
    })),
  };
}

// The times flattening gives a template track in an instance: its own times by template id, the template moved to
// the anchor, or none.
function placedTimes(track: LineTrack, instance: Instance): TrackTimes {
  if (instance.ownTiming) return storedTimes(ownTimedTrack(track, instance.ownTiming));
  return storedTimes(instance.at === undefined ? untimedTrack(track) : retimedTrack(track, instance.at));
}

function spanRules([begin, end]: Span): TrackRule[] {
  if (!Number.isFinite(begin) || !Number.isFinite(end)) return ["non-finite-time"];
  return [...(begin < 0 ? ["negative-begin" as const] : []), ...(begin > end ? ["begin-after-end" as const] : [])];
}

function trackRules(times: TrackTimes): TrackRule[] {
  const report = validateTrack(
    times.syllables.map(({ span, ...parts }) => ({
      ...parts,
      ...(span && { span: [msFromSeconds(span[0]), msFromSeconds(span[1])] as const }),
    })),
  );
  return [
    ...(times.span ? spanRules(times.span) : []),
    ...[...report.errors, ...report.warnings].map(({ rule }) => rule),
  ];
}

// The latest end of any finite time, for the song end check.
function latestEnd(times: TrackTimes): number {
  let latest = Number.NEGATIVE_INFINITY;
  for (const span of [times.span, ...times.syllables.map((syllable) => syllable.span)]) {
    if (span && Number.isFinite(span[1])) latest = Math.max(latest, span[1]);
  }
  return latest;
}

function pushRules(rules: readonly TrackRule[], node: string, report: DocReport): void {
  for (const rule of rules) (isWarningRule(rule) ? report.warnings : report.errors).push({ node, rule });
}

// -- Lines --------------------------------------------------------------------

// Ids, track order, the track span rule and agents; times too unless the line is a template.
function lineFindings(
  line: LyricLine,
  node: string,
  agentIds: ReadonlySet<string>,
  report: DocReport,
  isTemplate = false,
): void {
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
    const rules = trackRules(storedTimes(track));
    pushRules(isTemplate ? rules.filter((rule) => !TIME_RULES.has(rule)) : rules, node, report);
    if (track.role === "main" && !agentIds.has(track.agentId)) fail("unknown-agent");
  });
}

// -- Instances ----------------------------------------------------------------

interface BodyWalk {
  doc: Doc;
  report: DocReport;
  templateLines: ReadonlyMap<string, ReadonlyMap<number, TemplateLine>>;
  placedSlots: Map<string, Set<number>>;
  latestEndByInstance: Map<string, number>;
}

// One instance span of the body: each slot is placed once and flattens to a replaced or a template line, whose
// placed times are checked where they land.
function spanFindings(key: string, slots: readonly number[], walk: BodyWalk): void {
  const { doc, report } = walk;
  const node = `body ${key}`;
  const instance = doc.instances[key];
  if (!instance) {
    report.errors.push({ node, rule: "unknown-instance" });
    return;
  }
  for (const slot of slots) {
    const placed = walk.placedSlots.get(key) ?? new Set<number>();
    if (placed.has(slot)) report.errors.push({ node, rule: "duplicate-slot" });
    walk.placedSlots.set(key, placed.add(slot));
    if (instance.lineIds[slot] === undefined) {
      report.errors.push({ node, rule: "unknown-slot" });
      continue;
    }
    const replaced = instance.replaced?.[slot];
    const template = replaced ? undefined : walk.templateLines.get(instance.groupId)?.get(slot);
    if (!replaced && !template) {
      report.errors.push({ node, rule: "unknown-template-line" });
      continue;
    }
    const tracks = replaced
      ? replaced.tracks.map(storedTimes)
      : (template?.tracks ?? []).map((track) => placedTimes(track, instance));
    if (template) {
      for (const times of tracks)
        pushRules(
          trackRules(times).filter((rule) => TIME_RULES.has(rule)),
          `instance ${key}:${slot}`,
          report,
        );
    }
    const latest = Math.max(walk.latestEndByInstance.get(key) ?? Number.NEGATIVE_INFINITY, ...tracks.map(latestEnd));
    walk.latestEndByInstance.set(key, latest);
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
  const walk: BodyWalk = {
    doc,
    report,
    templateLines: new Map(
      Object.entries(doc.templates).map(([groupId, lines]) => [
        groupId,
        new Map(lines.map((line) => [line.slot, line])),
      ]),
    ),
    placedSlots: new Map(),
    latestEndByInstance: new Map(),
  };
  for (const item of doc.body) {
    if (isInstanceSpan(item)) {
      spanFindings(item.key, item.slots, walk);
      continue;
    }
    const node = `line ${item.id}`;
    lineFindings(item, node, agentIds, report);
    seeLineId(item.id, node);
    if (item.groupId !== undefined && !groupIds.has(item.groupId)) report.errors.push({ node, rule: "unknown-group" });
  }
  for (const [groupId, template] of Object.entries(doc.templates)) {
    if (!groupIds.has(groupId)) report.errors.push({ node: `template ${groupId}`, rule: "unknown-group" });
    for (const line of template) lineFindings(line, `template ${groupId}:${line.slot}`, agentIds, report, true);
  }
  for (const [key, instance] of Object.entries(doc.instances)) {
    const node = `instance ${key}`;
    for (const id of Object.values(instance.lineIds)) seeLineId(id, node);
    for (const [slot, line] of Object.entries(instance.replaced ?? {}))
      lineFindings(line, `${node}:${slot}`, agentIds, report);
    if (!groupIds.has(instance.groupId)) report.errors.push({ node, rule: "unknown-group" });
    const latest = walk.latestEndByInstance.get(key);
    if (songEnd !== undefined && latest !== undefined && msFromSeconds(latest) > msFromSeconds(songEnd)) {
      report.errors.push({ node, rule: "out-of-song" });
    }
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
