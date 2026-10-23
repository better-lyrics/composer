import {
  assignBinding,
  bindingToKeys,
  detectConflicts,
  getEffectiveBinding,
  migrateShortcutBindings,
  useShortcutBindingsStore,
} from "@/stores/shortcut-bindings";
import { SHORTCUT_REGISTRY } from "@/stores/shortcut-registry";
import { isMac } from "@/utils/platform";
import { describe, expect, it } from "vitest";

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
    const saved = {
      overrides: { "global.goToSync": { key: "z", mod: true }, "sync.tap": { key: "z", mod: true, shift: true } },
    };

    expect(migrateShortcutBindings(saved, 0)).toEqual(saved);
  });

  it("unbinds a timeline delete key when a saved timeline or global binding already uses it", () => {
    const saved = { overrides: { "timeline.mergeWords": { key: "Delete" }, "global.goToSync": { key: "Backspace" } } };

    expect(migrateShortcutBindings(saved, 2)).toEqual({
      overrides: {
        ...saved.overrides,
        "timeline.deleteSelection": { key: "" },
        "timeline.deleteSelectionAlternate": { key: "" },
      },
    });
  });

  it("unbinds a timeline clipboard shortcut when a saved timeline or global binding already uses its keys", () => {
    const saved = { overrides: { "timeline.mergeWords": { key: "c", mod: true } } };

    expect(migrateShortcutBindings(saved, 3)).toEqual({
      overrides: { ...saved.overrides, "timeline.copy": { key: "" } },
    });
  });

  describe("edge cases", () => {
    it("keeps the timeline delete keys when only another scope uses them", () => {
      const saved = { overrides: { "sync.tap": { key: "Backspace" } } };

      expect(migrateShortcutBindings(saved, 2)).toEqual(saved);
    });

    it("leaves saved bindings without a collision untouched", () => {
      const saved = { overrides: { "timeline.toggleFollow": { key: "q" } } };

      expect(migrateShortcutBindings(saved, 0)).toEqual(saved);
    });

    it.skipIf(isMac)("keeps a saved choice for the alternate redo itself", () => {
      const saved = {
        overrides: { "timeline.toggleFollow": CTRL_Y, "global.redoAlternate": { key: "y", mod: true, shift: true } },
      };

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

describe("toggleLoop id migration", () => {
  it("moves a rebinding from timeline.toggleGroupLoop to global.toggleLoop", () => {
    const binding = { key: "k", shift: true };
    const migrated = migrateShortcutBindings({ overrides: { "timeline.toggleGroupLoop": binding } }, 1);

    expect(migrated).toEqual({ overrides: { "global.toggleLoop": binding } });
  });

  it("leaves overrides without the old id alone", () => {
    const saved = { overrides: { "timeline.editWord": { key: "q" } } };

    expect(migrateShortcutBindings(saved, 1)).toEqual(saved);
  });

  it("drops a renamed rebinding that now clashes with a binding in another scope", () => {
    const syncTextVariant = { key: "l" };
    const migrated = migrateShortcutBindings(
      { overrides: { "timeline.toggleGroupLoop": syncTextVariant, "timeline.toggleTextVariant": { key: "q" } } },
      1,
    );

    expect(migrated).toEqual({ overrides: { "timeline.toggleTextVariant": { key: "q" } } });
  });

  it("regression: keeps a deliberately unbound group loop unbound", () => {
    const saved = { overrides: { "timeline.toggleGroupLoop": { key: "" }, "timeline.editWord": { key: "" } } };

    expect(migrateShortcutBindings(saved, 1)).toEqual({
      overrides: { "global.toggleLoop": { key: "" }, "timeline.editWord": { key: "" } },
    });
  });

  it("regression: unbinds the loop when its default would clash with a binding in another scope", () => {
    const saved = { overrides: { "sync.tap": { key: "l", shift: true } } };

    expect(migrateShortcutBindings(saved, 1)).toEqual({
      overrides: { "sync.tap": { key: "l", shift: true }, "global.toggleLoop": { key: "" } },
    });
  });

  it("unbinds the loop when both its rebinding and its default clash", () => {
    const saved = {
      overrides: {
        "timeline.toggleGroupLoop": { key: "l" },
        "timeline.toggleTextVariant": { key: "q" },
        "sync.tap": { key: "l", shift: true },
      },
    };

    expect(migrateShortcutBindings(saved, 1)).toEqual({
      overrides: {
        "global.toggleLoop": { key: "" },
        "timeline.toggleTextVariant": { key: "q" },
        "sync.tap": { key: "l", shift: true },
      },
    });
  });

  it("runs only for state saved before the rename", () => {
    const saved = { overrides: { "timeline.toggleGroupLoop": { key: "k" } } };

    expect(migrateShortcutBindings(saved, 2)).toEqual(saved);
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

describe("default bindings", () => {
  describe("invariants", () => {
    it("never conflict with each other", () => {
      useShortcutBindingsStore.setState({ overrides: {} });
      const conflicts = SHORTCUT_REGISTRY.flatMap((definition) =>
        detectConflicts(definition.id, definition.defaultBinding).map((other) => `${definition.id} / ${other.id}`),
      );
      expect(conflicts).toEqual([]);
    });
  });
});
