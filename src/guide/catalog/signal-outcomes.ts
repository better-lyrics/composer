import type { GuideSignal } from "@/domain/guide/model";

// -- Outcomes -----------------------------------------------------------------

// A tip teaches an outcome, so any route that reaches it counts: imported or pasted lyrics are words in the project.
const GUIDE_SIGNAL_OUTCOMES: Readonly<Partial<Record<GuideSignal, readonly GuideSignal[]>>> = {
  "import.lyrics": ["edit.type"],
  "import.search": ["edit.type"],
  "edit.smartPaste": ["edit.type"],
};

// -- Exports ------------------------------------------------------------------

export { GUIDE_SIGNAL_OUTCOMES };
