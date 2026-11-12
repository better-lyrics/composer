// -- Types --------------------------------------------------------------------

// Records written before media moved to Blobs still hold an ArrayBuffer, which is capped at IndexedDB's value limit.
type StoredData = Blob | ArrayBuffer;

// -- Reads --------------------------------------------------------------------

function storedDataBytes(stored: StoredData): number {
  return stored instanceof Blob ? stored.size : stored.byteLength;
}

// Only builds before Blob storage wrote inline bytes, so only they can hold data an old repair still has to read.
function isInlineData(stored: StoredData): stored is ArrayBuffer {
  return !(stored instanceof Blob);
}

function storedDataBuffer(stored: StoredData): Promise<ArrayBuffer> {
  return stored instanceof Blob ? stored.arrayBuffer() : Promise.resolve(stored);
}

// -- Exports ------------------------------------------------------------------

export { isInlineData, storedDataBuffer, storedDataBytes };
export type { StoredData };
