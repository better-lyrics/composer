// -- Types ---------------------------------------------------------------------

interface IdentityFile {
  keyId: string;
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

type IdentityFileErrorKind = "not-identity" | "damaged";

// -- Constants -----------------------------------------------------------------

const IDENTITY_FILE_MESSAGES: Record<IdentityFileErrorKind, string> = {
  "not-identity": "This isn't a Better Lyrics identity file.",
  damaged: "This identity file is damaged. Export it again from Better Lyrics.",
};

const KEY_ID_LENGTH = 64;

// -- Errors --------------------------------------------------------------------

class IdentityFileError extends Error {
  readonly kind: IdentityFileErrorKind;

  constructor(kind: IdentityFileErrorKind) {
    super(IDENTITY_FILE_MESSAGES[kind]);
    this.kind = kind;
  }
}

// -- Functions -----------------------------------------------------------------

function isP256Jwk(value: unknown): value is JsonWebKey {
  if (!value || typeof value !== "object") return false;
  const jwk = value as Record<string, unknown>;
  return jwk.kty === "EC" && jwk.crv === "P-256" && typeof jwk.x === "string" && typeof jwk.y === "string";
}

function readJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new IdentityFileError("not-identity");
  }
}

function parseIdentityFile(text: string): IdentityFile {
  const parsed = readJson(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new IdentityFileError("not-identity");
  const file = parsed as Record<string, unknown>;
  const { keyId, publicKey, privateKey } = file;
  if (
    file.version !== 1 ||
    typeof keyId !== "string" ||
    keyId.length !== KEY_ID_LENGTH ||
    !isP256Jwk(publicKey) ||
    !isP256Jwk(privateKey) ||
    typeof privateKey.d !== "string"
  ) {
    throw new IdentityFileError("not-identity");
  }
  if (privateKey.x !== publicKey.x || privateKey.y !== publicKey.y) throw new IdentityFileError("damaged");
  return { keyId, publicKey, privateKey };
}

// -- Exports -------------------------------------------------------------------

export type { IdentityFile, IdentityFileErrorKind };
export { IdentityFileError, parseIdentityFile };
