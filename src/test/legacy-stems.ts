import { copyProjectStems, loadProjectStems, saveProjectStem } from "@/lib/project-stems";

// -- Helpers ------------------------------------------------------------------

type StemWrite = Parameters<typeof saveProjectStem>[2];

// A stem saved before the decode fix carries no priming mark.
async function saveStemFromOldBuild(id: string, songKey: string, write: StemWrite): Promise<void> {
  await saveProjectStem(id, songKey, write);
  const stems = await loadProjectStems(id);
  const saved = stems?.slots[write.slot];
  if (!stems || !saved) throw new Error(`stem ${write.slot} was not saved`);
  const { primingCorrected: _mark, ...unmarked } = saved;
  await copyProjectStems(id, { ...stems, slots: { ...stems.slots, [write.slot]: unmarked } });
}

// -- Exports ------------------------------------------------------------------

export { saveStemFromOldBuild };
