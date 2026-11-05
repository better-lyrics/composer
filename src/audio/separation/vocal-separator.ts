// -- Types --------------------------------------------------------------------

interface ProcessOptions {
  channels: Float32Array[];
  totalFrames: number;
  onProgress?: (processed: number, total: number) => void;
}

interface ProcessResult {
  vocals: Float32Array[];
  numChannels: number;
  totalFrames: number;
}

/** A vocal model the separation pipeline can run: loaded (downloading it once), then run on a song. */
interface VocalSeparator {
  init(onProgress?: (loaded: number, total: number) => void): Promise<void>;
  process(opts: ProcessOptions): Promise<ProcessResult>;
}

// -- Exports ------------------------------------------------------------------

export type { ProcessOptions, ProcessResult, VocalSeparator };
