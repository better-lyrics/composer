// -- Types --------------------------------------------------------------------

type Rgb = readonly [number, number, number];
type PaletteStop = readonly [position: number, colour: Rgb];

interface PaletteLookup {
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
}

// -- Constants ----------------------------------------------------------------

const HEAT_STOPS: readonly PaletteStop[] = [
  [0, [0x00, 0x00, 0x04]],
  [0.14, [0x1b, 0x0c, 0x41]],
  [0.32, [0x4a, 0x0c, 0x6b]],
  [0.5, [0xa5, 0x2c, 0x60]],
  [0.68, [0xe3, 0x59, 0x33]],
  [0.84, [0xfc, 0xa5, 0x0a]],
  [1, [0xfc, 0xff, 0xa4]],
];

const PHASE_STOPS: readonly PaletteStop[] = [
  [0, [0x00, 0x00, 0x00]],
  [0.35, [0x0a, 0x24, 0x63]],
  [0.6, [0x1e, 0x6f, 0xd9]],
  [0.82, [0x12, 0xb7, 0x6a]],
  [1, [0xc6, 0xf6, 0xd5]],
];

// -- Functions ----------------------------------------------------------------

function paletteLookup(stops: readonly PaletteStop[]): PaletteLookup {
  const lookup: PaletteLookup = { r: new Uint8Array(256), g: new Uint8Array(256), b: new Uint8Array(256) };
  for (let level = 0; level < 256; level++) {
    const t = level / 255;
    let segment = 0;
    while (segment < stops.length - 2 && t > stops[segment + 1][0]) segment++;
    const [p0, c0] = stops[segment];
    const [p1, c1] = stops[segment + 1];
    const u = Math.min(1, Math.max(0, (t - p0) / (p1 - p0)));
    lookup.r[level] = Math.round(c0[0] + (c1[0] - c0[0]) * u);
    lookup.g[level] = Math.round(c0[1] + (c1[1] - c0[1]) * u);
    lookup.b[level] = Math.round(c0[2] + (c1[2] - c0[2]) * u);
  }
  return lookup;
}

// -- Exports ------------------------------------------------------------------

export { HEAT_STOPS, PHASE_STOPS, paletteLookup };
export type { PaletteLookup, PaletteStop, Rgb };
