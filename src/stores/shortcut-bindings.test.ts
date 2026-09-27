import { describe, expect, it } from "vitest";
import {
  assignBinding,
  bindingToKeys,
  detectConflicts,
  getEffectiveBinding,
  useShortcutBindingsStore,
} from "@/stores/shortcut-bindings";

describe("assignBinding", () => {
  it("sets the binding", () => {
    assignBinding("timeline.toggleFollow", { key: "q" });
    expect(getEffectiveBinding("timeline.toggleFollow")).toEqual({ key: "q" });
  });

  it("unbinds a conflicting shortcut that is still on its default", () => {
    assignBinding("timeline.toggleFollow", { key: "p" });
    expect(getEffectiveBinding("timeline.togglePreview").key).toBe("");
    expect(getEffectiveBinding("timeline.toggleFollow")).toEqual({ key: "p" });
  });

  it("unbinds a conflicting shortcut that was overridden", () => {
    useShortcutBindingsStore.setState({ overrides: { "timeline.togglePreview": { key: "q" } } });
    assignBinding("timeline.toggleFollow", { key: "q" });
    expect(getEffectiveBinding("timeline.togglePreview").key).toBe("");
  });

  it("leaves shortcuts in a scope that does not overlap", () => {
    assignBinding("sync.holdSync", { key: "p" });
    expect(getEffectiveBinding("timeline.togglePreview")).toEqual({ key: "p" });
    expect(getEffectiveBinding("sync.holdSync")).toEqual({ key: "p" });
  });

  describe("invariants", () => {
    it("leaves no conflict behind", () => {
      assignBinding("timeline.toggleFollow", { key: "p" });
      expect(detectConflicts("timeline.toggleFollow", getEffectiveBinding("timeline.toggleFollow"))).toEqual([]);
    });

    it("writes everything in one store update", () => {
      let updates = 0;
      const unsubscribe = useShortcutBindingsStore.subscribe(() => {
        updates++;
      });
      assignBinding("timeline.toggleFollow", { key: "p" });
      unsubscribe();
      expect(updates).toBe(1);
    });
  });
});

describe("bindingToKeys", () => {
  it("uppercases a single-character key", () => {
    expect(bindingToKeys({ key: "p", shift: true })).toEqual(["Shift", "P"]);
  });

  it("shows Space for the space key", () => {
    expect(bindingToKeys({ key: " " })).toEqual(["Space"]);
  });

  it("orders modifiers before the key", () => {
    expect(bindingToKeys({ key: "k", mod: true, alt: true })).toEqual(["Mod", "Alt", "K"]);
  });

  it("keeps a named key as is", () => {
    expect(bindingToKeys({ key: "ArrowLeft" })).toEqual(["ArrowLeft"]);
  });

  describe("edge cases", () => {
    it("returns no keys for an unbound shortcut", () => {
      expect(bindingToKeys({ key: "" })).toEqual([]);
    });
  });
});
