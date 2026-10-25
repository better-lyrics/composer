import { hashFile } from "@/audio/separation/audio-codec";
import { hasCachedModel } from "@/audio/separation/model-cache";
import { getModelDescriptor, isModelHostingConfigured } from "@/audio/separation/model-registry";
import { cancelSeparationWorker, disposeSeparationWorker } from "@/audio/separation/shared-separation-worker";
import { isProjectStemJobKey } from "@/audio/separation/stem-job-liveness";
import { beginLoadingStemJob, endLoadingStemJob, isStemJobLoading, stemJobKey } from "@/audio/separation/stem-store";
import type { SeparationError, SeparationStatus, Stem } from "@/audio/separation/types";
import { STEM_SLOTS, type StemOrigin, type StemSlot } from "@/domain/stems/stem-slot";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { playableFile, useAudioStore } from "@/stores/audio";
import { storeSeparatedStems } from "@/stores/separated-stem-write";
import { runModelDownload } from "@/stores/separation-model-download";
import { separateSongFile } from "@/stores/separation-pipeline";
import { useSettingsStore } from "@/stores/settings";
import { type ImportedStemDetails, resolveStems, songKeyFor } from "@/stores/stem-sources";
import { nextStemUrls, releaseStemUrls } from "@/stores/stem-urls";
import { type StemImportState, commitStemImport, prepareStemImport, removeProjectStem } from "@/stores/stem-import";
import { create } from "zustand";

interface SeparationState extends StemImportState {
  status: SeparationStatus;
  progress: { loaded: number; total: number };
  error: SeparationError | null;
  currentStem: Stem;
  otherStem: Exclude<Stem, "original">;
  availableStems: Stem[];
  modelCached: boolean;
  jobKey: string | null;
  stemUrls: Partial<Record<Stem, string>>;
  stemOrigins: Partial<Record<StemSlot, StemOrigin>>;
  stemDetails: Partial<Record<StemSlot, ImportedStemDetails>>;
  hostingConfigured: boolean;
}

interface SeparationActions {
  refreshModelCacheStatus: () => Promise<void>;
  refreshForCurrentSource: () => Promise<void>;
  separate: () => Promise<void>;
  importStem: (slot: StemSlot, file: File) => Promise<void>;
  acceptPendingImport: () => Promise<void>;
  cancelPendingImport: () => void;
  removeImportedStem: (slot: StemSlot) => Promise<void>;
  selectStem: (stem: Stem) => void;
  restoreCurrentStem: (stem: Stem) => void;
  cancel: () => void;
  retry: () => Promise<void>;
  reset: () => void;
}

let isCancelling = false;
let separationRun = 0;
let separatingFile: File | null = null;
let stemsFile: File | null = null;
let refreshRun = 0;

function endSeparationRun(): void {
  separationRun += 1;
}

function beginSeparationRun(): () => boolean {
  endSeparationRun();
  const run = separationRun;
  return () => run === separationRun;
}

function beginRefreshRun(): () => boolean {
  refreshRun += 1;
  const run = refreshRun;
  return () => run === refreshRun;
}

// A refresh for another song ends the running separation; a refresh for the same song keeps it.
function endSeparationOfOtherSong(file: File | null): void {
  if (separatingFile === file) return;
  endSeparationRun();
  separatingFile = null;
}

const LOG_PREFIX = "[Separation]";
const NO_STEMS = { availableStems: ["original"] as Stem[], stemUrls: {}, stemOrigins: {}, stemDetails: {} };

const useSeparationStore = create<SeparationState & SeparationActions>((set, get) => ({
  status: "idle",
  progress: { loaded: 0, total: 0 },
  error: null,
  currentStem: "original",
  otherStem: "vocals",
  availableStems: ["original"],
  modelCached: false,
  jobKey: null,
  stemUrls: {},
  stemOrigins: {},
  stemDetails: {},
  pendingImport: null,
  importError: null,
  hostingConfigured: isModelHostingConfigured(),

  refreshModelCacheStatus: async () => {
    const variant = useSettingsStore.getState().vocalModelVariant;
    const descriptor = getModelDescriptor(variant);
    if (!descriptor) {
      set({ modelCached: false, hostingConfigured: false });
      return;
    }
    const cached = await hasCachedModel(descriptor);
    set({ modelCached: cached, hostingConfigured: true });
  },

  refreshForCurrentSource: async () => {
    const isCurrentRun = beginRefreshRun();
    const source = useAudioStore.getState().source;
    const projectId = openProjectIdSnapshot();
    const file = playableFile(source);
    endSeparationOfOtherSong(file);
    if (file !== stemsFile) {
      releaseStemUrls(get().stemUrls);
      set({ ...NO_STEMS, jobKey: null });
      stemsFile = file;
    }
    if (!file) {
      set({ currentStem: "original", status: "idle" });
      return;
    }
    const variant = useSettingsStore.getState().vocalModelVariant;
    try {
      const audioHash = await hashFile(file);
      const cacheJobKey = stemJobKey(audioHash, variant);
      beginLoadingStemJob(cacheJobKey);
      try {
        const resolved = await resolveStems(projectId, songKeyFor(source, audioHash), audioHash, variant);
        if (!isCurrentRun()) return;
        const stemUrls = nextStemUrls(get().stemUrls, resolved.slots);
        const slots = STEM_SLOTS.filter((slot) => resolved.slots[slot]);
        const availableStems: Stem[] = ["original", ...slots];
        const { currentStem, status } = get();
        const busy = separatingFile !== null && (status === "downloading" || status === "processing");
        set({
          jobKey: resolved.jobKey,
          availableStems,
          stemUrls,
          stemOrigins: Object.fromEntries(slots.map((slot) => [slot, resolved.slots[slot]?.origin])),
          stemDetails: Object.fromEntries(slots.map((slot) => [slot, resolved.slots[slot]?.details])),
          currentStem: availableStems.includes(currentStem) ? currentStem : "original",
          ...(busy || status === "error" ? {} : { status: slots.length > 0 ? "ready" : "idle" }),
        });
      } finally {
        endLoadingStemJob(cacheJobKey);
      }
    } catch (error) {
      console.error(LOG_PREFIX, "could not load the stems for this song", error);
    }
  },

  separate: async () => {
    if (!get().hostingConfigured) {
      set({
        status: "error",
        error: { code: "no-base-url", message: "Vocal model URL is not configured." },
      });
      return;
    }
    const source = useAudioStore.getState().source;
    const projectId = openProjectIdSnapshot();
    const file = playableFile(source);
    if (!file || STEM_SLOTS.every((slot) => get().stemUrls[slot])) return;

    isCancelling = false;
    const isCurrentRun = beginSeparationRun();
    separatingFile = file;
    try {
      const variant = useSettingsStore.getState().vocalModelVariant;
      if (!(await runModelDownload(set, variant, () => isCancelling))) return;
      if (!isCurrentRun()) return;
      set({ modelCached: true });

      const separated = await separateSongFile(file, {
        set,
        isCurrentRun,
        isCancelling: () => isCancelling,
        onHashed: (audioHash) => {
          if (!isProjectStemJobKey(get().jobKey)) set({ jobKey: stemJobKey(audioHash, variant) });
        },
      });
      if (!separated || !isCurrentRun()) return;
      try {
        await storeSeparatedStems({
          audioHash: separated.audioHash,
          songKey: songKeyFor(source, separated.audioHash),
          variant,
          files: separated.stemFiles,
          durationSeconds: separated.durationSeconds,
          projectId: isProjectStemJobKey(get().jobKey) ? projectId : undefined,
          emptySlots: STEM_SLOTS.filter((slot) => !get().stemUrls[slot]),
        });
      } catch (err) {
        if (isCurrentRun()) set({ status: "error", error: { code: "unknown", message: (err as Error).message } });
      }
      if (isCurrentRun()) separatingFile = null;
      if (useAudioStore.getState().source === source) await get().refreshForCurrentSource();
    } finally {
      if (isCurrentRun()) separatingFile = null;
    }
  },

  importStem: async (slot, file) => {
    const ready = await prepareStemImport(slot, file, set);
    if (ready && (await commitStemImport(slot, file, ready, set))) await get().refreshForCurrentSource();
  },

  acceptPendingImport: async () => {
    const pending = get().pendingImport;
    if (!pending) return;
    set({ pendingImport: null });
    if (await commitStemImport(pending.slot, pending.file, pending, set)) {
      await get().refreshForCurrentSource();
    }
  },

  cancelPendingImport: () => set({ pendingImport: null }),

  removeImportedStem: async (slot) => {
    await removeProjectStem(slot, set);
    await get().refreshForCurrentSource();
  },

  selectStem: (stem) => {
    const available = get().availableStems;
    if (!available.includes(stem)) return;
    set(stem === "original" ? { currentStem: stem } : { currentStem: stem, otherStem: stem });
  },

  // Called once at boot by usePersistence to seed currentStem from the saved
  // project, before useAutoSeparate's source subscription runs
  // refreshForCurrentSource. Unlike selectStem this intentionally bypasses the
  // availableStems guard, because at restore time the available list hasn't
  // been populated yet. refreshForCurrentSource handles eviction by overwriting
  // back to "original" when the cached stems are gone.
  restoreCurrentStem: (stem) => {
    set(stem === "original" ? { currentStem: stem } : { currentStem: stem, otherStem: stem });
  },

  cancel: () => {
    isCancelling = true;
    endSeparationRun();
    separatingFile = null;
    cancelSeparationWorker();
    set({ status: "idle", progress: { loaded: 0, total: 0 } });
  },

  retry: async () => {
    set({ error: null });
    await get().separate();
  },

  reset: () => {
    endSeparationRun();
    separatingFile = null;
    stemsFile = null;
    refreshRun += 1;
    releaseStemUrls(get().stemUrls);
    disposeSeparationWorker();
    set({
      status: "idle",
      progress: { loaded: 0, total: 0 },
      error: null,
      ...NO_STEMS,
      currentStem: "original",
      otherStem: "vocals",
      jobKey: null,
      pendingImport: null,
      importError: null,
    });
  },
}));

function toggledStem(): Stem {
  const { currentStem, otherStem } = useSeparationStore.getState();
  return currentStem === "original" ? otherStem : "original";
}

function isStemJobInUse(jobKey: string): boolean {
  return jobKey === useSeparationStore.getState().jobKey || isStemJobLoading(jobKey);
}

export { useSeparationStore, isStemJobInUse, toggledStem };
