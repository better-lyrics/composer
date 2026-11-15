/**
 * @vitest-environment node
 */

import { changedFields, updatedLine, withFields } from "@/test/field-updates";
import { backgroundTrack, mainTrack, roleWords } from "insync/line-track";
import { lineFromFields } from "@/domain/line/line-from-fields";
import { describe, expect, it } from "vitest";
import type { LyricLine } from "insync/line";
import { backgroundText, lineText } from "insync/line-text";
import { diffEditTextChange } from "./diff-edit-text";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

describe("diffEditTextChange", () => {
  it("returns no updates and no structural change when nothing differs", () => {
    const lines: LyricLine[] = [
      lineFromFields({ id: "L1", text: "first", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
      lineFromFields({ id: "L2", text: "second", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
    ];
    const result = diffEditTextChange(lines, lines);
    expect(result.contentUpdates).toHaveLength(0);
    expect(result.hasStructuralChange).toBe(false);
  });

  it("emits a content update for a same-id text change", () => {
    const old: LyricLine[] = [lineFromFields({ id: "L1", text: "I love you", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER)];
    const next: LyricLine[] = [lineFromFields({ id: "L1", text: "I luv you", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER)];
    const result = diffEditTextChange(old, next);
    expect(result.hasStructuralChange).toBe(false);
    expect(changedFields(result.contentUpdates, old)).toEqual([{ id: "L1", updates: { text: "I luv you" } }]);
  });

  it("forwards explicit undefined for words when a word-synced source loses them", () => {
    const old: LyricLine[] = [
      lineFromFields(
        {
          id: "L1",
          text: "I love",
          agentId: "v1",
          words: [{ id: "w1", text: "I love", sep: "", begin: 0, end: 1, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const next: LyricLine[] = [lineFromFields({ id: "L1", text: "I luv", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER)];
    const result = diffEditTextChange(old, next);
    expect(result.hasStructuralChange).toBe(false);
    expect(result.contentUpdates).toHaveLength(1);
    const u = result.contentUpdates[0];
    const patch = changedFields([u], old)[0].updates;
    expect(u.id).toBe("L1");
    expect(lineText(updatedLine(u.updates)!, DEFAULT_SPLIT_CHARACTER)).toBe("I luv");
    expect("words" in patch).toBe(true);
    expect(roleWords(updatedLine(u.updates), "main")).toBeUndefined();
  });

  it("forwards explicit undefined for begin/end when a line-synced source loses them", () => {
    const old: LyricLine[] = [
      lineFromFields({ id: "L1", text: "I love", agentId: "v1", begin: 0, end: 1 }, DEFAULT_SPLIT_CHARACTER),
    ];
    const next: LyricLine[] = [lineFromFields({ id: "L1", text: "I luv", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER)];
    const result = diffEditTextChange(old, next);
    expect(result.contentUpdates).toHaveLength(1);
    const u = result.contentUpdates[0];
    const patch = changedFields([u], old)[0].updates;
    expect("begin" in patch).toBe(true);
    expect(updatedLine(u.updates) && mainTrack(updatedLine(u.updates)!).begin).toBeUndefined();
    expect("end" in patch).toBe(true);
    expect(updatedLine(u.updates) && mainTrack(updatedLine(u.updates)!).end).toBeUndefined();
  });

  it("flags hasStructuralChange when length differs (insertion)", () => {
    const old: LyricLine[] = [lineFromFields({ id: "L1", text: "first", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER)];
    const next: LyricLine[] = [
      lineFromFields({ id: "L1", text: "first", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
      lineFromFields({ id: "L2", text: "second", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
    ];
    const result = diffEditTextChange(old, next);
    expect(result.hasStructuralChange).toBe(true);
  });

  it("flags hasStructuralChange when length differs (deletion)", () => {
    const old: LyricLine[] = [
      lineFromFields({ id: "L1", text: "first", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
      lineFromFields({ id: "L2", text: "second", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
    ];
    const next: LyricLine[] = [lineFromFields({ id: "L1", text: "first", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER)];
    const result = diffEditTextChange(old, next);
    expect(result.hasStructuralChange).toBe(true);
  });

  it("flags hasStructuralChange when ids reorder", () => {
    const old: LyricLine[] = [
      lineFromFields({ id: "L1", text: "first", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
      lineFromFields({ id: "L2", text: "second", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
    ];
    const next: LyricLine[] = [
      lineFromFields({ id: "L2", text: "second", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
      lineFromFields({ id: "L1", text: "first", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
    ];
    const result = diffEditTextChange(old, next);
    expect(result.hasStructuralChange).toBe(true);
  });

  it("flags hasStructuralChange when an id is replaced", () => {
    const old: LyricLine[] = [
      lineFromFields({ id: "L1", text: "first", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
      lineFromFields({ id: "L2", text: "second", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
    ];
    const next: LyricLine[] = [
      lineFromFields({ id: "L1", text: "first", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
      lineFromFields({ id: "L3", text: "second", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
    ];
    const result = diffEditTextChange(old, next);
    expect(result.hasStructuralChange).toBe(true);
  });

  it("emits backgroundText update when only background differs", () => {
    const old: LyricLine[] = [lineFromFields({ id: "L1", text: "main", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER)];
    const next: LyricLine[] = [
      lineFromFields({ id: "L1", text: "main", agentId: "v1", backgroundText: "ah" }, DEFAULT_SPLIT_CHARACTER),
    ];
    const result = diffEditTextChange(old, next);
    expect(result.hasStructuralChange).toBe(false);
    expect(changedFields(result.contentUpdates, old)).toEqual([{ id: "L1", updates: { backgroundText: "ah" } }]);
  });

  it("emits a backgroundTextSource update when provenance is cleared", () => {
    const old: LyricLine[] = [
      lineFromFields(
        {
          id: "L1",
          text: "main",
          agentId: "v1",
          backgroundText: "ooh",
          backgroundTextSource: "extraction",
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const next: LyricLine[] = [lineFromFields({ id: "L1", text: "main", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER)];
    const result = diffEditTextChange(old, next);
    expect(result.contentUpdates).toHaveLength(1);
    const u = result.contentUpdates[0];
    const patch = changedFields([u], old)[0].updates;
    expect("backgroundText" in patch).toBe(true);
    expect(backgroundText(updatedLine(u.updates), DEFAULT_SPLIT_CHARACTER)).toBeUndefined();
    expect("backgroundTextSource" in patch).toBe(true);
    expect(updatedLine(u.updates) && backgroundTrack(updatedLine(u.updates)!)?.source).toBeUndefined();
  });

  it("does not emit updates for fields untouched by the new line", () => {
    const old: LyricLine[] = [
      lineFromFields(
        { id: "L1", text: "a", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const next: LyricLine[] = [
      lineFromFields(
        { id: "L1", text: "a edited", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const result = diffEditTextChange(old, next);
    expect(result.contentUpdates).toHaveLength(1);
    const u = result.contentUpdates[0];
    const patch = changedFields([u], old)[0].updates;
    expect(Object.keys(patch)).toEqual(["text"]);
    expect(lineText(updatedLine(u.updates)!, DEFAULT_SPLIT_CHARACTER)).toBe("a edited");
  });

  it("treats a length-equal mix of content edits as content-only", () => {
    const old: LyricLine[] = [
      lineFromFields({ id: "L1", text: "first", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
      lineFromFields({ id: "L2", text: "second", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
    ];
    const next: LyricLine[] = [withFields(old[0], { text: "first edit" }), structuredClone(old[1])];
    const result = diffEditTextChange(old, next);
    expect(result.hasStructuralChange).toBe(false);
    expect(changedFields(result.contentUpdates, old)).toEqual([{ id: "L1", updates: { text: "first edit" } }]);
  });
});
