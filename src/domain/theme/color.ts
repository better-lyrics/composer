// -- Color math ----------------------------------------------------------------
// Hand-rolled sRGB helpers. No dependencies. All math mirrors the themes mockup
// and the WCAG 2.x relative-luminance / contrast formulae.

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const adjust = amount >= 0 ? (v: number) => v + (255 - v) * amount : (v: number) => v * (1 + amount);
  return rgbToHex(adjust(r), adjust(g), adjust(b));
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const linear = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [hi, lo] = lA > lB ? [lA, lB] : [lB, lA];
  return (hi + 0.05) / (lo + 0.05);
}

export { isHexColor, hexToRgb, rgbToHex, lighten, relativeLuminance, contrastRatio };
