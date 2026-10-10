import { describe, expect, it } from "vitest";
import {
  assignBinding,
  bindingToKeys,
  detectConflicts,
  getEffectiveBinding,
  migrateShortcutBindings,
  useShortcutBindingsStore,
} from "@/stores/shortcut-bindings";
import { isMac } from "@/utils/platform";

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

describe("migrateShortcutBindings", () => {
  const CTRL_Y = { key: "y", mod: true };

  it.skipIf(isMac)("unbinds the Ctrl+Y alternate redo when a saved binding already uses Ctrl+Y", () => {
    const migrated = migrateShortcutBindings({ overrides: { "timeline.toggleFollow": CTRL_Y } }, 0);

    expect(migrated).toEqual({ overrides: { "timeline.toggleFollow": CTRL_Y, "global.redoAlternate": { key: "" } } });
  });

  it("keeps undo and redo bound when a saved binding uses their keys, because both fired before", () => {
    const saved = { overrides: { "global.goToSync": { key: "z", mod: true }, "sync.tap": { key: "z", mod: true, shift: true } } };

    expect(migrateShortcutBindings(saved, 0)).toEqual(saved);
  });

  describe("edge cases", () => {
    it("leaves saved bindings without a collision untouched", () => {
      const saved = { overrides: { "timeline.toggleFollow": { key: "q" } } };

      expect(migrateShortcutBindings(saved, 0)).toEqual(saved);
    });

    it.skipIf(isMac)("keeps a saved choice for the alternate redo itself", () => {
      const saved = { overrides: { "timeline.toggleFollow": CTRL_Y, "global.redoAlternate": { key: "y", mod: true, shift: true } } };

      expect(migrateShortcutBindings(saved, 0)).toEqual(saved);
    });

    it("runs only for state saved before the alternate redo existed", () => {
      const saved = { overrides: { "timeline.toggleFollow": CTRL_Y } };

      expect(migrateShortcutBindings(saved, 1)).toEqual(saved);
    });

    it.each([null, undefined, "garbage", {}])("passes malformed saved state %s through", (saved) => {
      expect(migrateShortcutBindings(saved, 0)).toEqual(saved);
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
