import {
  SPECTRUM_BAND_HEIGHT,
  SPECTRUM_SETTING_DEFAULTS,
  clampSpectrumBandHeight,
  isDefaultSpectrumLook,
  sanitizeSpectrumSettings,
  spectrumLookDefaults,
} from "@/domain/spectrum/settings";
import { describe, expect, it } from "vitest";

describe("spectrum settings", () => {
  it("defaults to the agreed look", () => {
    expect(SPECTRUM_SETTING_DEFAULTS).toEqual({
      showSpectrum: false,
      spectrumBandHeight: 168,
      spectrumSource: "vocals",
      spectrumPalette: "heat",
      spectrumContrast: -72,
      spectrumScale: "mel",
      spectrumTop: "full",
      spectrumWindow: "auto",
      spectrumPhase: "change",
    });
  });

  it("treats only look keys as resettable", () => {
    const look = spectrumLookDefaults();
    expect(isDefaultSpectrumLook(look)).toBe(true);
    expect(isDefaultSpectrumLook({ ...look, spectrumContrast: -60 })).toBe(false);
    expect(Object.keys(look)).not.toContain("showSpectrum");
    expect(Object.keys(look)).not.toContain("spectrumBandHeight");
  });

  describe("edge cases", () => {
    it("clamps the band height and rounds it", () => {
      expect(clampSpectrumBandHeight(10)).toBe(SPECTRUM_BAND_HEIGHT.min);
      expect(clampSpectrumBandHeight(999)).toBe(SPECTRUM_BAND_HEIGHT.max);
      expect(clampSpectrumBandHeight(200.6)).toBe(201);
      expect(clampSpectrumBandHeight(Number.NaN)).toBe(SPECTRUM_BAND_HEIGHT.default);
    });

    it("drops persisted values it does not recognise", () => {
      expect(
        sanitizeSpectrumSettings({
          spectrumPalette: "rainbow",
          spectrumScale: "log",
          spectrumContrast: "x",
          spectrumWindow: "4096",
        }),
      ).toEqual({ spectrumScale: "log" });
    });
  });
});
