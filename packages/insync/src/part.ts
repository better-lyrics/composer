import type { Passthrough } from "./passthrough";

// -- Types --------------------------------------------------------------------

// A labelled stretch of lines, such as a verse or chorus, apart from link groups.
interface Part {
  readonly id: string;
  readonly kind?: string;
  readonly lineIds: readonly string[];
  readonly passthrough?: Passthrough;
}

// -- Exports ------------------------------------------------------------------

export type { Part };
