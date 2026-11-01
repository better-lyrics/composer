import type { ParseResult } from "@/utils/lyrics-parsers/shared";
import type { LyricsSearchQuery } from "@/utils/lyrics-search/types";
import type { ImportSourceInfo } from "@/views/lyrics-import-modal/import-lyrics";
import { create } from "zustand";

// -- Types --------------------------------------------------------------------

type ImportModalSection = "search" | "paste" | "upload";

interface LastImportResult {
  parsed: ParseResult;
  source: ImportSourceInfo;
}

interface SearchInputs {
  track: string;
  artist: string;
  album: string;
  duration: string;
  videoId: string;
  isrc?: string;
}

interface SearchDraft {
  projectId: string | undefined;
  inputs: SearchInputs;
}

interface ImportModalState {
  isOpen: boolean;
  prefill: LyricsSearchQuery | null;
  searchDraft: SearchDraft | null;
  initialSection: ImportModalSection | null;
  lastImportResult: LastImportResult | null;
}

interface OpenArgs {
  prefill?: LyricsSearchQuery;
  section?: ImportModalSection;
}

interface ImportModalStore extends ImportModalState {
  open: (args?: OpenArgs) => void;
  close: () => void;
  setSearchDraft: (draft: SearchDraft) => void;
  recordImportResult: (parsed: ParseResult, source: ImportSourceInfo) => void;
  clearImportResult: () => void;
}

// -- Defaults -----------------------------------------------------------------

const INITIAL_STATE: ImportModalState = {
  isOpen: false,
  prefill: null,
  searchDraft: null,
  initialSection: null,
  lastImportResult: null,
};

// -- Store --------------------------------------------------------------------

const useImportModalStore = create<ImportModalStore>()((set) => ({
  ...INITIAL_STATE,

  open: (args) => {
    const explicit = args?.prefill;
    set({
      isOpen: true,
      prefill: explicit ?? null,
      initialSection: args?.section ?? null,
      ...(explicit ? { searchDraft: null } : {}),
    });
  },

  close: () => {
    set({ isOpen: false, prefill: null, initialSection: null });
  },

  setSearchDraft: (draft) => {
    set({ searchDraft: draft });
  },

  recordImportResult: (parsed, source) => {
    set({ lastImportResult: { parsed, source } });
  },

  clearImportResult: () => {
    set({ lastImportResult: null });
  },
}));

// -- Public hooks -------------------------------------------------------------

function useImportModal(): (args?: OpenArgs) => void {
  return useImportModalStore.getState().open;
}

function useImportModalState(): Omit<ImportModalState, "lastImportResult" | "searchDraft"> {
  const isOpen = useImportModalStore((s) => s.isOpen);
  const prefill = useImportModalStore((s) => s.prefill);
  const initialSection = useImportModalStore((s) => s.initialSection);
  return { isOpen, prefill, initialSection };
}

function useLastImportResult(): LastImportResult | null {
  return useImportModalStore((s) => s.lastImportResult);
}

// -- Exports ------------------------------------------------------------------

export { INITIAL_STATE, useImportModal, useImportModalState, useImportModalStore, useLastImportResult };
export type { ImportModalSection, SearchInputs };
