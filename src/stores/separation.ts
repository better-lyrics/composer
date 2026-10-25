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
import { resolveStems } from "@/stores/stem-sources";
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
  hostingConfigured: boolean;
}

interface SeparationActions {
  refreshModelCacheStatus: () => Promise<void>;
  refreshForCurrentSource: () => Promise<void>;
  downloadModel: () => Promise<void>;
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

const NO_STEMS = { availableStems: ["original"] as Stem[], stemUrls: {}, stemOrigins: {} };

function revokeUrls(urls: Partial<Record<Stem, string>>) {
  for (const url of Object.values(urls)) {
    if (url) URL.revokeObjectURL(url);
  }
}

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
    const file = playableFile(useAudioStore.getState().source);
    endSeparationOfOtherSong(file);
    if (!file) {
      revokeUrls(get().stemUrls);
      set({ ...NO_STEMS, jobKey: null, currentStem: "original", status: "idle" });
      return;
    }
    const variant = useSettingsStore.getState().vocalModelVariant;
    const audioHash = await hashFile(file);
    const cacheJobKey = stemJobKey(audioHash, variant);
    beginLoadingStemJob(cacheJobKey);
    try {
      const resolved = await resolveStems(openProjectIdSnapshot(), audioHash, variant);
      if (!isCurrentRun()) return;
      revokeUrls(get().stemUrls);
      const stemUrls: Partial<Record<Stem, string>> = {};
      for (const slot of STEM_SLOTS) {
        const blob = resolved.files[slot];
        if (blob) stemUrls[slot] = URL.createObjectURL(blob);
      }
      const availableStems: Stem[] = ["original", ...STEM_SLOTS.filter((slot) => stemUrls[slot])];
      const { currentStem, status } = get();
      const busy = separatingFile !== null && (status === "downloading" || status === "processing");
      set({
        jobKey: resolved.jobKey,
        availableStems,
        stemUrls,
        stemOrigins: resolved.origins,
        currentStem: availableStems.includes(currentStem) ? currentStem : "original",
        ...(busy ? {} : { status: availableStems.length > 1 ? "ready" : "idle" }),
      });
    } finally {
      endLoadingStemJob(cacheJobKey);
    }
  },

  downloadModel: async () => {
    if (!get().hostingConfigured) {
      set({
        status: "error",
        error: { code: "no-base-url", message: "Vocal model URL is not configured." },
      });
      return;
    }
    isCancelling = false;
    const variant = useSettingsStore.getState().vocalModelVariant;
    if (await runModelDownload(set, variant, () => isCancelling)) {
      set({ status: "idle", modelCached: true });
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
    const file = playableFile(useAudioStore.getState().source);
    if (!file || STEM_SLOTS.every((slot) => get().stemUrls[slot])) return;

    isCancelling = false;
    const isCurrentRun = beginSeparationRun();
    separatingFile = file;
    const projectOwned = isProjectStemJobKey(get().jobKey);
    const variant = useSettingsStore.getState().vocalModelVariant;
    if (!(await runModelDownload(set, variant, () => isCancelling))) return;
    if (!isCurrentRun()) return;
    set({ modelCached: true });

    const separated = await separateSongFile(file, {
      set,
      isCurrentRun,
      isCancelling: () => isCancelling,
      onHashed: (audioHash) => {
        if (!projectOwned) set({ jobKey: stemJobKey(audioHash, variant) });
      },
    });
    if (!separated) return;
    const { audioHash, stemFiles, durationSeconds } = separated;
    if (!isCurrentRun()) return;
    try {
      await storeSeparatedStems({
        audioHash,
        variant,
        files: stemFiles,
        durationSeconds,
        projectOwned: isProjectStemJobKey(get().jobKey),
        currentOrigins: get().stemOrigins,
      });
    } catch (err) {
      if (!isCurrentRun()) return;
      set({ status: "error", error: { code: "unknown", message: (err as Error).message } });
      return;
    }
    if (!isCurrentRun()) return;
    separatingFile = null;
    await get().refreshForCurrentSource();
  },

  importStem: async (slot, file) => {
    const durationSeconds = await prepareStemImport(slot, file, set);
    if (durationSeconds === null) return;
    if (await commitStemImport(slot, file, durationSeconds, set)) await get().refreshForCurrentSource();
  },

  acceptPendingImport: async () => {
    const pending = get().pendingImport;
    if (!pending) return;
    set({ pendingImport: null });
    if (await commitStemImport(pending.slot, pending.file, pending.durationSeconds, set)) {
      await get().refreshForCurrentSource();
    }
  },

  cancelPendingImport: () => set({ pendingImport: null }),

  removeImportedStem: async (slot) => {
    await removeProjectStem(slot);
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
    refreshRun += 1;
    revokeUrls(get().stemUrls);
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
