import { getShortcutDescription } from "@/stores/shortcut-bindings";
import { SHORTCUT_DEFINITIONS, type ShortcutBinding, type ShortcutScope } from "@/stores/shortcut-definitions";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const bindingSignature = (binding: ShortcutBinding): string =>
  [
    binding.key,
    binding.shift ? "shift" : "",
    binding.alt ? "alt" : "",
    binding.ctrl ? "ctrl" : "",
    binding.meta ? "meta" : "",
    binding.mod ? "mod" : "",
  ].join("|");

const SCOPES: ShortcutScope[] = ["global", "sync", "timeline", "library"];

// -- Tests --------------------------------------------------------------------

describe("SHORTCUT_DEFINITIONS", () => {
  it("registers the marker-mode toggle with default key 'i' in the timeline scope", () => {
    const markerMode = SHORTCUT_DEFINITIONS.find((d) => d.id === "timeline.toggleMarkerMode");

    expect(markerMode).toBeDefined();
    expect(markerMode?.scope).toBe("timeline");
    expect(markerMode?.defaultBinding.key).toBe("i");
    expect(markerMode?.defaultBinding.shift).toBeUndefined();
    expect(markerMode?.defaultBinding.alt).toBeUndefined();
    expect(markerMode?.defaultBinding.ctrl).toBeUndefined();
    expect(markerMode?.defaultBinding.meta).toBeUndefined();
    expect(markerMode?.defaultBinding.mod).toBeUndefined();
  });

  it("registers the drop-marker-at-playhead shortcut with default Shift+I in the timeline scope", () => {
    const dropMarker = SHORTCUT_DEFINITIONS.find((d) => d.id === "timeline.dropSnapMarkerAtPlayhead");

    expect(dropMarker).toBeDefined();
    expect(dropMarker?.scope).toBe("timeline");
    expect(dropMarker?.defaultBinding.key).toBe("i");
    expect(dropMarker?.defaultBinding.shift).toBe(true);
    expect(dropMarker?.defaultBinding.alt).toBeUndefined();
    expect(dropMarker?.defaultBinding.ctrl).toBeUndefined();
    expect(dropMarker?.defaultBinding.meta).toBeUndefined();
    expect(dropMarker?.defaultBinding.mod).toBeUndefined();
  });

  it("registers the four snap-point jump shortcuts with their exact default bindings in the timeline scope", () => {
    const expectedBindings: Record<string, ShortcutBinding> = {
      "timeline.jumpPrevSnapPoint": { key: "ArrowLeft", shift: true },
      "timeline.jumpNextSnapPoint": { key: "ArrowRight", shift: true },
      "timeline.jumpPrevSnapPointFine": { key: "ArrowLeft", shift: true, alt: true },
      "timeline.jumpNextSnapPointFine": { key: "ArrowRight", shift: true, alt: true },
    };

    for (const [id, binding] of Object.entries(expectedBindings)) {
      const definition = SHORTCUT_DEFINITIONS.find((d) => d.id === id);
      expect(definition, `missing definition for ${id}`).toBeDefined();
      expect(definition?.scope).toBe("timeline");
      expect(definition?.defaultBinding).toEqual(binding);
    }
  });

  it("registers the project shortcuts with their exact default bindings in the global scope", () => {
    const expectedBindings: Record<string, ShortcutBinding> = {
      "global.openProjectSwitcher": { key: "o", mod: true },
      "global.newProject": { key: "n", mod: true, alt: true },
      "global.saveNow": { key: "s", mod: true },
    };
    for (const [id, binding] of Object.entries(expectedBindings)) {
      const definition = SHORTCUT_DEFINITIONS.find((d) => d.id === id);
      expect(definition, `missing definition for ${id}`).toBeDefined();
      expect(definition?.scope).toBe("global");
      expect(definition?.defaultBinding).toEqual(binding);
    }
  });

  it("registers the group focus shortcuts with their exact default bindings in the timeline scope", () => {
    const expectedBindings: Record<string, ShortcutBinding> = {
      "timeline.openGroup": { key: "Enter" },
      "timeline.closeGroup": { key: "Escape" },
    };
    for (const [id, binding] of Object.entries(expectedBindings)) {
      const definition = SHORTCUT_DEFINITIONS.find((d) => d.id === id);
      expect(definition, `missing definition for ${id}`).toBeDefined();
      expect(definition?.scope).toBe("timeline");
      expect(definition?.defaultBinding).toEqual(binding);
    }
  });

  it("registers the library shortcuts with their exact default bindings in the library scope", () => {
    const search = SHORTCUT_DEFINITIONS.find((d) => d.id === "library.focusSearch");
    const remove = SHORTCUT_DEFINITIONS.find((d) => d.id === "library.deleteSelection");
    expect(search).toMatchObject({ scope: "library", description: "Search projects", defaultBinding: { key: "/" } });
    expect(remove).toMatchObject({
      scope: "library",
      description: "Delete selected projects",
      defaultBinding: { key: "Backspace" },
    });
  });

  describe("invariants", () => {
    it("has a unique id for every definition", () => {
      const ids = SHORTCUT_DEFINITIONS.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("ships a non-empty default key for every definition", () => {
      for (const definition of SHORTCUT_DEFINITIONS) {
        expect(definition.defaultBinding.key).not.toBe("");
      }
    });

    it("ships a non-empty description for every definition", () => {
      for (const definition of SHORTCUT_DEFINITIONS) {
        expect(definition.description.trim()).not.toBe("");
      }
    });

    it.each(SCOPES)("has no duplicate default binding within the %s scope", (scope) => {
      const signatures = SHORTCUT_DEFINITIONS.filter((d) => d.scope === scope).map((d) =>
        bindingSignature(d.defaultBinding),
      );

      expect(new Set(signatures).size).toBe(signatures.length);
    });
  });
});

describe("getShortcutDescription", () => {
  it("returns the registry description for a known shortcut", () => {
    expect(getShortcutDescription("sync.tap")).toBe("Tap to sync");
    expect(getShortcutDescription("sync.holdSync")).toBe("Hold to sync");
  });

  it("returns a description for every registered shortcut", () => {
    for (const definition of SHORTCUT_DEFINITIONS) {
      expect(getShortcutDescription(definition.id)).toBe(definition.description);
    }
  });

  it("edge case: falls back to the id for an unknown shortcut", () => {
    expect(getShortcutDescription("does.not.exist")).toBe("does.not.exist");
  });

  it("edge case: falls back to the id for an empty string", () => {
    expect(getShortcutDescription("")).toBe("");
  });
});
