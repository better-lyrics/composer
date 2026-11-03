// -- Derivations ---------------------------------------------------------------

function isOwnLyric(lyric: { submitter?: { keyId: string } }, keyId: string | null): boolean {
  return keyId !== null && lyric.submitter?.keyId === keyId;
}

// -- Exports -------------------------------------------------------------------

export { isOwnLyric };
