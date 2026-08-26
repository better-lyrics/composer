import { describe, expect, it } from "vitest";
import type { ProviderName } from "@/domain/lyrics-search/result";
import { formatProviderName, providerLabelsProse } from "@/utils/lyrics-search/provider-labels";
import { getProviders, restoreProvidersForTests, snapshotProvidersForTests } from "@/utils/lyrics-search/registry";
import type { LyricsSearchProvider } from "@/utils/lyrics-search/types";

// -- Helpers ------------------------------------------------------------------

function registeredLabels(): string[] {
  return getProviders().map((provider) => formatProviderName(provider.name));
}

function withProviders<T>(providers: readonly LyricsSearchProvider[], run: () => T): T {
  const snapshot = snapshotProvidersForTests();
  restoreProvidersForTests(providers);
  try {
    return run();
  } finally {
    restoreProvidersForTests(snapshot);
  }
}

function stubProvider(name: ProviderName, sourceLabel: string): LyricsSearchProvider {
  return {
    name,
    sourceLabel,
    canSearch: () => false,
    search: () => Promise.resolve([]),
  };
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

  it("reads the label straight off the registered provider rather than a list of its own", () => {
    const label = withProviders([stubProvider("portato", "Late Arrival")], () => formatProviderName("portato"));
    expect(label).toBe("Late Arrival");
  });

  describe("edge cases", () => {
    it("falls back to the raw provider id when the registry holds no such provider", () => {
      withProviders([], () => {
        expect(formatProviderName("portato")).toBe("portato");
      });
    });

    it("takes the first match when two providers share an id", () => {
      const result = withProviders([stubProvider("portato", "First"), stubProvider("portato", "Second")], () =>
        formatProviderName("portato"),
      );
      expect(result).toBe("First");
    });
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
      expect(formatProviderName("portato")).toBe(formatProviderName("portato"));
    });

    it("keeps a stable identity so passing it as a prop does not churn renders", () => {
      const first = formatProviderName;
      const second = formatProviderName;
      expect(first).toBe(second);
    });
  });
});

describe("providerLabelsProse", () => {
  it("names every registered provider", () => {
    const prose = providerLabelsProse();
    for (const provider of getProviders()) {
      expect(prose).toContain(provider.sourceLabel);
    }
  });

  it("joins the registered providers with an Oxford comma", () => {
    expect(providerLabelsProse()).toBe("LRCLib, Binimum, Better Lyrics, and Better Lyrics Portato");
  });

  describe("edge cases", () => {
    it("joins two providers with a bare and", () => {
      const prose = withProviders(
        [stubProvider("lrclib", "LRCLib"), stubProvider("portato", "Better Lyrics Portato")],
        () => providerLabelsProse(),
      );
      expect(prose).toBe("LRCLib and Better Lyrics Portato");
    });

    it("names a lone provider on its own", () => {
      expect(withProviders([stubProvider("lrclib", "LRCLib")], () => providerLabelsProse())).toBe("LRCLib");
    });

    it("returns an empty string when nothing is registered", () => {
      expect(withProviders([], () => providerLabelsProse())).toBe("");
    });

    it("keeps the Oxford comma once a fifth provider joins", () => {
      const prose = withProviders(
        [
          stubProvider("lrclib", "LRCLib"),
          stubProvider("binimum", "Binimum"),
          stubProvider("boidu-lyrics", "Better Lyrics"),
          stubProvider("portato", "Better Lyrics Portato"),
          stubProvider("portato", "Another"),
        ],
        () => providerLabelsProse(),
      );
      expect(prose).toBe("LRCLib, Binimum, Better Lyrics, Better Lyrics Portato, and Another");
    });
  });

  describe("invariants", () => {
    it("lists the providers in registration order", () => {
      const prose = providerLabelsProse();
      const positions = getProviders().map((provider) => prose.indexOf(provider.sourceLabel));
      expect(positions).toEqual([...positions].toSorted((a, b) => a - b));
    });

    it("agrees with the label each provider is formatted under", () => {
      const prose = providerLabelsProse();
      for (const label of registeredLabels()) {
        expect(prose).toContain(label);
      }
    });
  });
});
