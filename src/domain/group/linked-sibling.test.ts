import { describe, expect, it } from "vitest";
import { updatedLinkedSibling } from "@/domain/group/linked-sibling";
import { fieldsOfLine } from "@/domain/line/line-from-fields";
import { mainTrack } from "@/domain/line/track";
import { createLine } from "@/test/factories";
import { type FieldPatch, withFields } from "@/test/field-updates";

const link = { groupId: "g1", templateLineIdx: 0 };
const source = createLine({ ...link, id: "a", instanceIdx: 0, text: "Hello", backgroundText: "oh" });
const sibling = createLine({
  ...link,
  id: "b",
  instanceIdx: 1,
  text: "Hello",
  words: [{ text: "Hello", begin: 9, end: 10 }],
  backgroundText: "oh",
});

// The sibling after the source took a flat patch, read back as flat fields.
function siblingAfter(patch: FieldPatch) {
  const { tracks } = withFields(source, patch);
  return fieldsOfLine(updatedLinkedSibling(sibling, source, { tracks }));
}

describe("updatedLinkedSibling", () => {
  it("propagates text, agentId, and backgroundText", () => {
    expect(siblingAfter({ text: "Hi", agentId: "v2", backgroundText: "ah" })).toMatchObject({
      text: "Hi",
      agentId: "v2",
      backgroundText: "ah",
    });
  });

  it("leaves what the source kept", () => {
    expect(siblingAfter({ text: "Hi" })).toMatchObject({ text: "Hi", agentId: mainTrack(sibling).agentId });
  });

  it("propagates a clear of the main timing", () => {
    const timedSource = withFields(source, {
      words: [{ id: "s1", text: "Hello", sep: "", begin: 1, end: 2, joinsNext: false }],
    });
    const cleared = withFields(timedSource, { words: undefined });
    const after = fieldsOfLine(updatedLinkedSibling(sibling, timedSource, { tracks: cleared.tracks }));
    expect(after.words).toBeUndefined();
    expect(after.text).toBe("Hello");
  });

  it("does not propagate timing the source gained", () => {
    const after = siblingAfter({ words: [{ id: "s1", text: "Hello", sep: "", begin: 1, end: 2, joinsNext: false }] });
    expect(after.words?.map((word) => [word.begin, word.end])).toEqual([[9, 10]]);
  });

  it("does not propagate a line span the source gained", () => {
    const after = siblingAfter({ begin: 5, end: 9 });
    expect(after.begin).toBeUndefined();
    expect(after.words?.map((word) => [word.begin, word.end])).toEqual([[9, 10]]);
  });

  it("carries the background provenance flag", () => {
    expect(siblingAfter({ backgroundText: "ooh", backgroundTextSource: "extraction" })).toMatchObject({
      backgroundText: "ooh",
      backgroundTextSource: "extraction",
    });
    expect(siblingAfter({ backgroundText: "yeah", backgroundTextSource: "manual" })).toMatchObject({
      backgroundText: "yeah",
      backgroundTextSource: "manual",
    });
  });

  it("does not invent a provenance flag when only backgroundText is updated", () => {
    const after = siblingAfter({ backgroundText: "hey" });
    expect(after.backgroundText).toBe("hey");
    expect(after.backgroundTextSource).toBeUndefined();
  });

  it("propagates a clear of the background", () => {
    const after = siblingAfter({ backgroundText: undefined, backgroundTextSource: undefined });
    expect(after.backgroundText).toBeUndefined();
    expect(after.backgroundTextSource).toBeUndefined();
  });
});
