// -- Correct/incorrect mark token defaults -------------------------------------
// Shared so the dark and light mark colors never drift between preset files. The
// dark teal and red drop to 1.67:1 and 2.55:1 on the light presets, so each
// scheme carries its own value rather than one hardcoded pair.

const DARK_POSITIVE = "#4fd6c0";
const LIGHT_POSITIVE = "#2a9d8f";

const DARK_NEGATIVE = "#f2777a";
const LIGHT_NEGATIVE = "#c2453f";

export { DARK_POSITIVE, LIGHT_POSITIVE, DARK_NEGATIVE, LIGHT_NEGATIVE };
