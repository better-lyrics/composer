import { openProjectSessionGeneration, subscribeOpenProjectId } from "@/lib/open-project-session";
import type { SearchInputs } from "@/views/lyrics-import-modal/search-inputs";

// -- Interfaces ---------------------------------------------------------------

interface ModalDrafts {
  "paste-translations": { pastedText: string; text: string; manualRows: string[] | null };
  "import-lyrics": { text: string };
  "lyrics-search": SearchInputs;
}

type ModalDraftKey = keyof ModalDrafts;

// -- Module state -------------------------------------------------------------

let drafts: Partial<ModalDrafts> = {};
let draftGeneration = openProjectSessionGeneration();

// -- Public API ---------------------------------------------------------------

function readModalDraft<Key extends ModalDraftKey>(key: Key): ModalDrafts[Key] | undefined {
  return drafts[key];
}

function writeModalDraft<Key extends ModalDraftKey>(key: Key, draft: ModalDrafts[Key]): void {
  drafts = { ...drafts, [key]: draft };
}

function clearModalDraft(key: ModalDraftKey): void {
  const { [key]: _cleared, ...rest } = drafts;
  drafts = rest;
}

// -- Wiring -------------------------------------------------------------------

subscribeOpenProjectId(() => {
  const generation = openProjectSessionGeneration();
  if (generation !== draftGeneration) drafts = {};
  draftGeneration = generation;
});

// -- Exports ------------------------------------------------------------------

export { clearModalDraft, readModalDraft, writeModalDraft };
