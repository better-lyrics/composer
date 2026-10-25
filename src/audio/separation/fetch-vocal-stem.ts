// -- Functions ----------------------------------------------------------------

async function fetchVocalStem(vocalsUrl: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(vocalsUrl, { signal });
  if (!response.ok) throw new Error(`Could not read the vocal stem (${response.status}).`);
  return response.blob();
}

// -- Exports ------------------------------------------------------------------

export { fetchVocalStem };
