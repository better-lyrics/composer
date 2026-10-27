import { listStemJobs, putStem, removeStemJobs, stemJobKey } from "@/audio/separation/stem-store";
import { createSpectrumChunkWriter, readSpectrumChunks } from "@/audio/spectrum/spectrum-cache";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const job = stemJobKey("h1", "fp32");

async function separate(): Promise<void> {
  await putStem("h1", "vocals", "fp32", new Blob([new Uint8Array(10)]));
  await putStem("h1", "instrumental", "fp32", new Blob([new Uint8Array(20)]));
}

function chunkBytes(chunk: number, salt: number): Uint8Array {
  return Uint8Array.from({ length: 64 }, (_, i) => (chunk * 31 + i * 7 + salt) % 256);
}

async function writeChunks(chunks: readonly number[]): Promise<void> {
  const writer = createSpectrumChunkWriter(job, "vocals", "", 44100, 1024);
  for (const chunk of chunks) writer.add(chunk, chunkBytes(chunk, 1), chunkBytes(chunk, 2));
  await writer.flush();
}

// -- Tests --------------------------------------------------------------------

describe("spectrum chunk cache", () => {
  it("reads back every written chunk byte for byte", async () => {
    await separate();
    const chunks = Array.from({ length: 20 }, (_, i) => i);
    await writeChunks(chunks);
    const read = await readSpectrumChunks(job, "vocals", "", 44100, 1024, 20);
    expect(read.size).toBe(20);
    for (const chunk of chunks) {
      expect(read.get(chunk)?.magnitude).toEqual(chunkBytes(chunk, 1));
      expect(read.get(chunk)?.phaseChange).toEqual(chunkBytes(chunk, 2));
    }
  });

  describe("edge cases", () => {
    it("returns only the chunks that exist", async () => {
      await separate();
      await writeChunks([0, 3]);
      expect([...(await readSpectrumChunks(job, "vocals", "", 44100, 1024, 6)).keys()].toSorted()).toEqual([0, 3]);
      expect((await readSpectrumChunks(job, "mix", "", 44100, 1024, 6)).size).toBe(0);
      expect((await readSpectrumChunks(job, "vocals", "", 48000, 1024, 6)).size).toBe(0);
      expect((await readSpectrumChunks(job, "vocals", "lt1", 44100, 1024, 6)).size).toBe(0);
    });
  });

  describe("invariants", () => {
    it("never writes for a job without stems", async () => {
      await writeChunks([0, 1]);
      expect(await listStemJobs()).toEqual([]);
    });

    it("leaves the job's created-at time alone and goes with the job", async () => {
      await separate();
      const [before] = await listStemJobs();
      await writeChunks([0]);
      const [after] = await listStemJobs();
      expect(after?.createdAt).toBe(before?.createdAt);
      expect(after?.bytes).toBeGreaterThan(before?.bytes ?? 0);
      await removeStemJobs([job]);
      expect((await readSpectrumChunks(job, "vocals", "", 44100, 1024, 1)).size).toBe(0);
    });
  });
});
