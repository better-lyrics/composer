import { describe, expect, it } from "vitest";
import { SHORTCUT_DEFINITIONS, type ShortcutBinding, type ShortcutScope } from "@/stores/shortcut-definitions";

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

const SCOPES: ShortcutScope[] = ["global", "sync", "timeline"];

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
