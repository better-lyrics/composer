// -- Interfaces ---------------------------------------------------------------

interface BodyProgress {
  received: number;
  total: number | null;
}

// -- Reading ------------------------------------------------------------------

function contentLength(response: Response): number | null {
  const length = Number(response.headers.get("content-length"));
  return Number.isFinite(length) && length > 0 ? length : null;
}

async function readBodyWithProgress(
  response: Response,
  onProgress: (progress: BodyProgress) => void,
): Promise<ArrayBuffer> {
  if (!response.body) return response.arrayBuffer();
  const total = contentLength(response);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  onProgress({ received, total });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress({ received, total });
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

// -- Exports ------------------------------------------------------------------

export type { BodyProgress };
export { readBodyWithProgress };
