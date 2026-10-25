import { derivedRecordKey, getDerivedRecord, putDerivedRecords } from "@/audio/separation/stem-derived-records";
import type { PitchTrack } from "@/domain/pitch/track";
import { notifyStorageSignal } from "@/lib/storage-signals";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Pitch cache]";
const HEADER_BYTES = 24;

// -- Layout -------------------------------------------------------------------

// The frame count is stored so a truncated record never decodes as a shorter track.
function sectionOffsets(frameCount: number) {
  const confidence = HEADER_BYTES + frameCount * 4;
  const loudness = confidence + frameCount + (frameCount % 2);
  return { confidence, loudness, total: loudness + frameCount * 2 };
}

function encodePitchTrack(track: PitchTrack): Uint8Array {
  const frameCount = track.frequencyHz.length;
  const offsets = sectionOffsets(frameCount);
  const buffer = new ArrayBuffer(offsets.total);
  const header = new DataView(buffer);
  header.setFloat64(0, track.hopSeconds, true);
  header.setFloat64(8, track.startSeconds, true);
  header.setUint32(16, frameCount, true);
  new Float32Array(buffer, HEADER_BYTES, frameCount).set(track.frequencyHz);
  new Uint8Array(buffer, offsets.confidence, frameCount).set(track.confidencePercent);
  new Int16Array(buffer, offsets.loudness, frameCount).set(track.loudnessDb);
  return new Uint8Array(buffer);
}

function decodePitchTrack(bytes: Uint8Array): PitchTrack | null {
  if (bytes.length < HEADER_BYTES) {
    console.warn(LOG_PREFIX, "pitch record is shorter than its header", bytes.length);
    return null;
  }
  const buffer = bytes.slice().buffer;
  const header = new DataView(buffer);
  const hopSeconds = header.getFloat64(0, true);
  const startSeconds = header.getFloat64(8, true);
  const frameCount = header.getUint32(16, true);
  const offsets = sectionOffsets(frameCount);
  if (offsets.total !== bytes.length || !(hopSeconds > 0) || !Number.isFinite(startSeconds)) {
    console.warn(LOG_PREFIX, "pitch record does not match its header", { bytes: bytes.length, frameCount });
    return null;
  }
  return {
    hopSeconds,
    startSeconds,
    frequencyHz: new Float32Array(buffer, HEADER_BYTES, frameCount),
    confidencePercent: new Uint8Array(buffer, offsets.confidence, frameCount),
    loudnessDb: new Int16Array(buffer, offsets.loudness, frameCount),
  };
}

// -- Storage ------------------------------------------------------------------

function pitchRecordKey(jobKey: string): string {
  return derivedRecordKey(jobKey, "pitch", "v1");
}

async function readCachedPitchTrack(jobKey: string): Promise<PitchTrack | null> {
  const blob = await getDerivedRecord(pitchRecordKey(jobKey));
  return blob ? decodePitchTrack(new Uint8Array(await blob.arrayBuffer())) : null;
}

async function cachePitchTrack(jobKey: string, track: PitchTrack): Promise<void> {
  const blob = new Blob([encodePitchTrack(track)], { type: "application/octet-stream" });
  if (await putDerivedRecords(jobKey, new Map([[pitchRecordKey(jobKey), blob]]))) notifyStorageSignal("media-stored");
}

// -- Exports ------------------------------------------------------------------

export { cachePitchTrack, decodePitchTrack, encodePitchTrack, readCachedPitchTrack };
