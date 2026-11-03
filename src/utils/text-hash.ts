// -- Constants -----------------------------------------------------------------

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

// -- Functions -----------------------------------------------------------------

// FNV-1a: a cheap fingerprint for cache keys, never for security.
function textHash(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(36);
}

// -- Exports -------------------------------------------------------------------

export { textHash };
