// -- Derivations ---------------------------------------------------------------

function isOwnLyric(lyric: { submitter?: { keyId: string } }, keyId: string | null): boolean {
  return keyId !== null && lyric.submitter?.keyId === keyId;
}

// The server leaves `submitter` out when it cannot describe one, which never proves the lyric is someone else's.
function isOtherAccountLyric(lyric: { submitter?: { keyId: string } }, keyId: string): boolean {
  return lyric.submitter !== undefined && lyric.submitter.keyId !== keyId;
}

// -- Exports -------------------------------------------------------------------

export { isOtherAccountLyric, isOwnLyric };
