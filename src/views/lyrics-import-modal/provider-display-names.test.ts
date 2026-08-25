import { describe, expect, it } from "vitest";
import { getProviders } from "@/utils/lyrics-search/registry";
import { formatProviderName, PROVIDER_DISPLAY_NAMES } from "@/views/lyrics-import-modal/provider-display-names";

// -- Tests --------------------------------------------------------------------

describe("PROVIDER_DISPLAY_NAMES", () => {
  it("labels every provider the registry can produce an error for", () => {
    const registered = getProviders()
      .map((provider) => provider.name)
      .toSorted();
    expect(Object.keys(PROVIDER_DISPLAY_NAMES).toSorted()).toEqual(registered);
  });

  it("agrees with the source label each provider advertises", () => {
    for (const provider of getProviders()) {
      expect(PROVIDER_DISPLAY_NAMES[provider.name]).toBe(provider.sourceLabel);
    }
  });

  describe("invariants", () => {
    it("gives every provider a distinct label so a combined error message stays unambiguous", () => {
      const labels = Object.values(PROVIDER_DISPLAY_NAMES);
      expect(new Set(labels).size).toBe(labels.length);
    });

    it("stores labels without stray whitespace", () => {
      for (const label of Object.values(PROVIDER_DISPLAY_NAMES)) {
        expect(label).toBe(label.trim());
        expect(label.length).toBeGreaterThan(0);
      }
    });
  });
});

describe("formatProviderName", () => {
  it("renders the human label for every registered provider", () => {
    for (const provider of getProviders()) {
      expect(formatProviderName(provider.name)).toBe(provider.sourceLabel);
    }
  });

  it("never falls back to the raw provider id", () => {
    for (const provider of getProviders()) {
      expect(formatProviderName(provider.name)).not.toBe(provider.name);
    }
  });

  it("renders the known labels", () => {
    expect(formatProviderName("lrclib")).toBe("LRCLib");
    expect(formatProviderName("binimum")).toBe("Binimum");
    expect(formatProviderName("boidu-lyrics")).toBe("Better Lyrics");
    expect(formatProviderName("qq")).toBe("QQ Music");
  });

  describe("invariants", () => {
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
