import type { GuideSignal } from "@/domain/guide/model";

// -- Outcomes -----------------------------------------------------------------

// A tip teaches an outcome, so any route that reaches it counts: imported or pasted lyrics are words in the project.
const GUIDE_SIGNAL_OUTCOMES: Readonly<Partial<Record<GuideSignal, readonly GuideSignal[]>>> = {
  "edit.lyrics": ["edit.type"],
  "edit.search": ["edit.type"],
  "edit.smartPaste": ["edit.type"],
};

// -- Exports ------------------------------------------------------------------

export { GUIDE_SIGNAL_OUTCOMES };
