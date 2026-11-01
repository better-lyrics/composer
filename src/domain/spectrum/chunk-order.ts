// -- Constants -------------------------------------------------------------

const CHUNK_FRAMES = 256;

// -- Functions -------------------------------------------------------------

function chunkCount(frames: number): number {
  return Math.ceil(frames / CHUNK_FRAMES);
}

function chunkPriority(chunk: number, focus: number): number {
  return chunk >= focus ? chunk - focus : (focus - chunk) * 2;
}

function nextChunk(pending: ReadonlySet<number>, focus: number): number | null {
  let best: number | null = null;
  for (const chunk of pending) {
    if (best === null) {
      best = chunk;
      continue;
    }
    const priority = chunkPriority(chunk, focus);
    const bestPriority = chunkPriority(best, focus);
    if (priority < bestPriority || (priority === bestPriority && chunk > best)) best = chunk;
  }
  return best;
}

// -- Exports ---------------------------------------------------------------

export { CHUNK_FRAMES, chunkCount, nextChunk };
