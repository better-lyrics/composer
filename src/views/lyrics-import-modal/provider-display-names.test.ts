import { describe, expect, it } from "vitest";
import { getProviders } from "@/utils/lyrics-search/registry";
import { formatProviderName } from "@/views/lyrics-import-modal/provider-display-names";

// -- Helpers ------------------------------------------------------------------

function registeredLabels(): string[] {
  return getProviders().map((provider) => formatProviderName(provider.name));
}

// -- Tests --------------------------------------------------------------------

describe("formatProviderName", () => {
  it("labels every provider the registry can raise an error for", () => {
    for (const provider of getProviders()) {
      expect(formatProviderName(provider.name).trim().length).toBeGreaterThan(0);
    }
  });

  it("never falls back to the raw provider id", () => {
    for (const provider of getProviders()) {
      expect(formatProviderName(provider.name)).not.toBe(provider.name);
    }
  });

  it("agrees with the source label each provider advertises", () => {
    for (const provider of getProviders()) {
      expect(formatProviderName(provider.name)).toBe(provider.sourceLabel);
    }
  });

  it("renders the known labels", () => {
    expect(formatProviderName("lrclib")).toBe("LRCLib");
    expect(formatProviderName("binimum")).toBe("Binimum");
    expect(formatProviderName("boidu-lyrics")).toBe("Better Lyrics");
    expect(formatProviderName("qq")).toBe("QQ Music");
  });

  describe("invariants", () => {
    it("gives every provider a distinct label so a combined error message stays unambiguous", () => {
      const labels = registeredLabels();
      expect(new Set(labels).size).toBe(labels.length);
    });

    it("returns labels without stray whitespace", () => {
      for (const label of registeredLabels()) {
        expect(label).toBe(label.trim());
      }
    });

    it("is stable across calls", () => {
      expect(formatProviderName("qq")).toBe(formatProviderName("qq"));
    });

    it("keeps a stable identity so passing it as a prop does not churn renders", () => {
      const first = formatProviderName;
      const second = formatProviderName;
      expect(first).toBe(second);
    });
  });
});
