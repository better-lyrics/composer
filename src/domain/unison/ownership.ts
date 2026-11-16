// -- Derivations ---------------------------------------------------------------

function isOwnLyric(lyric: { submitter?: { keyId: string } }, keyId: string | null): boolean {
  return keyId !== null && lyric.submitter?.keyId === keyId;
}

function lyricOwnerName(lyric: { submitter?: { displayName: string } }): string | null {
  return lyric.submitter?.displayName ?? null;
}

// -- Exports -------------------------------------------------------------------

export { isOwnLyric, lyricOwnerName };
