import { encodeWavOffThread } from "@/audio/pcm-worker-host";
import { computeInstrumental } from "@/audio/separation/derived-stems";

// -- Types --------------------------------------------------------------------

interface SeparatedStemFiles {
  vocals: Blob;
  instrumental: Blob;
}

// -- Encoding -----------------------------------------------------------------

// Transfers the vocal buffers to the worker, so the caller must not read them afterwards.
async function encodeSeparatedStems(
  original: Float32Array[],
  vocals: Float32Array[],
  sampleRate: number,
): Promise<SeparatedStemFiles> {
  const instrumental = computeInstrumental(original, vocals);
  const [vocalsWav, instrumentalWav] = await Promise.all([
    encodeWavOffThread(vocals, sampleRate),
    encodeWavOffThread(instrumental, sampleRate),
  ]);
  return { vocals: vocalsWav, instrumental: instrumentalWav };
}

// -- Exports ------------------------------------------------------------------

export { encodeSeparatedStems };
