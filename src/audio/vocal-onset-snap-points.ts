import { detectVocalOnsets, mixToMono } from "@/audio/onset-detection";
import { decodeFileToFloat32 } from "@/audio/separation/audio-codec";

async function detectVocalOnsetsFromUrl(vocalsUrl: string): Promise<number[]> {
  const response = await fetch(vocalsUrl);
  if (!response.ok) throw new Error(`Could not read vocal stem (${response.status}).`);
  const stemBlob = await response.blob();
  const decoded = await decodeFileToFloat32(stemBlob);
  return detectVocalOnsets(mixToMono(decoded.channels), { sampleRate: decoded.sampleRate });
}

export { detectVocalOnsetsFromUrl };
