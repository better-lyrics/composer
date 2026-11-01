import { encodeWav } from "@/audio/wav-encode";
import type { StemSlot } from "@/domain/stems/stem-slot";
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

interface CroppedMp3Stem {
  sampleRate?: number;
  frames?: number;
  croppedFrames?: number;
}

// The WAV the old build stored for an imported mp3: its decode minus the cropped frames, beside the probed duration.
function croppedMp3StemWrite(
  slot: StemSlot,
  { sampleRate = 44_100, frames = 4410, croppedFrames = 1104 }: CroppedMp3Stem = {},
): StemWrite {
  const wav = encodeWav([new Float32Array(frames).fill(0.25)], sampleRate);
  return {
    slot,
    file: new File([wav], `${slot}.mp3`, { type: "audio/wav" }),
    origin: "imported",
    durationSeconds: (frames + croppedFrames) / sampleRate,
  };
}

// -- Exports ------------------------------------------------------------------

export { croppedMp3StemWrite, saveStemFromOldBuild };
