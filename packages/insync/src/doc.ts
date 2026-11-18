import type { Agent } from "./agent";
import type { LinkGroup, LyricDoc } from "./group";
import type { ProjectMetadata } from "./metadata";
import type { Part } from "./part";
import type { DocPassthrough } from "./passthrough";

// -- Types --------------------------------------------------------------------

// The song body with its group templates and instances, and everything its lines point at.
interface Doc extends LyricDoc {
  readonly groups: readonly LinkGroup[];
  readonly agents: readonly Agent[];
  readonly parts: readonly Part[];
  readonly metadata?: ProjectMetadata;
  readonly passthrough: DocPassthrough;
}

// -- Exports ------------------------------------------------------------------

export type { Doc };
