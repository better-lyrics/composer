import { openProjectIdSnapshot, subscribeOpenProjectId } from "@/lib/open-project-session";

// -- Interfaces ---------------------------------------------------------------

interface ModalDrafts {
  "paste-translations": { pastedText: string; text: string; manualRows: string[] | null };
  "import-lyrics": { text: string };
}

type ModalDraftKey = keyof ModalDrafts;

// -- Module state -------------------------------------------------------------

let drafts: Partial<ModalDrafts> = {};
let draftProjectId = openProjectIdSnapshot();

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
  const openId = openProjectIdSnapshot();
  // A first save gives the unsaved session its id; the drafts still belong to it.
  if (draftProjectId !== undefined) drafts = {};
  draftProjectId = openId;
});

// -- Exports ------------------------------------------------------------------

export { clearModalDraft, readModalDraft, writeModalDraft };
