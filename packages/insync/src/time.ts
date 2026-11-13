// -- Types --------------------------------------------------------------------

type Ms = number & { readonly brand: "Ms" };

// -- Conversion ---------------------------------------------------------------

function msFromSeconds(seconds: number): Ms {
  return Math.round(seconds * 1000) as Ms;
}

function secondsFromMs(ms: Ms): number {
  return ms / 1000;
}

// -- Exports ------------------------------------------------------------------

export { msFromSeconds, secondsFromMs };
export type { Ms };
