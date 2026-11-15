import type { Passthrough } from "./passthrough";

// -- Types --------------------------------------------------------------------

// A section nested in a song part, with the lines it wraps, written back inside the part's own.
interface PartSection {
  readonly kind?: string;
  readonly lineIds: readonly string[];
  readonly passthrough?: Passthrough;
  readonly sections?: readonly PartSection[];
}

// A labelled stretch of lines, such as a verse or chorus, apart from link groups.
interface Part extends PartSection {
  readonly id: string;
}

// -- Exports ------------------------------------------------------------------

export type { Part, PartSection };
