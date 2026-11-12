// -- Types --------------------------------------------------------------------

// Records written before media moved to Blobs still hold an ArrayBuffer, which is capped at IndexedDB's value limit.
type StoredData = Blob | ArrayBuffer;

// -- Reads --------------------------------------------------------------------

function storedDataBytes(data: StoredData): number {
  return data instanceof Blob ? data.size : data.byteLength;
}

// Only builds before Blob storage wrote inline bytes, so only they can hold data an old repair still has to read.
function isInlineData(data: StoredData): data is ArrayBuffer {
  return !(data instanceof Blob);
}

function storedDataBuffer(data: StoredData): Promise<ArrayBuffer> {
  return data instanceof Blob ? data.arrayBuffer() : Promise.resolve(data);
}

// -- Exports ------------------------------------------------------------------

export { isInlineData, storedDataBuffer, storedDataBytes };
export type { StoredData };
