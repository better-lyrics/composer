import { canonicalJson } from "@/domain/unison/canonical-json";
import { type IdentityFile, IdentityFileError, parseIdentityFile } from "@/domain/unison/identity-file";
import type { UnisonSessionResponse, UnisonSignedSessionBody } from "@/lib/unison/api-types";
import { createSession, fetchChallenge } from "@/lib/unison/endpoints";
import { ExtensionAuthError, requestSignedSession } from "@/lib/unison/extension-port";
import { type StoredUnisonSession, saveUnisonSession } from "@/lib/unison/session";
import { sha256Hex } from "@/utils/sha256-hex";

// -- Types ---------------------------------------------------------------------

type SignInErrorKind = "cancelled" | "not-allowed" | "failed";

// -- Constants -----------------------------------------------------------------

const ECDSA_P256 = { name: "ECDSA", namedCurve: "P-256" } as const;
const ECDSA_SHA256 = { name: "ECDSA", hash: "SHA-256" } as const;

const EXTENSION_REASON_KINDS: Record<string, SignInErrorKind> = {
  USER_CANCELLED: "cancelled",
  USER_DISMISSED: "cancelled",
  ORIGIN_MISMATCH: "not-allowed",
  NOT_ALLOWED: "not-allowed",
};

// -- Errors --------------------------------------------------------------------

class SignInError extends Error {
  readonly kind: SignInErrorKind;

  constructor(kind: SignInErrorKind, reason: string) {
    super(`Sign-in failed (${reason})`);
    this.kind = kind;
  }
}

class SupersededSignInError extends Error {
  constructor() {
    super("A newer sign-in replaced this one");
  }
}

// -- State ---------------------------------------------------------------------

let latestAttempt = 0;

// -- Helpers -------------------------------------------------------------------

function toBase64(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function publicKeyId(jwk: JsonWebKey): Promise<string> {
  const canonical = canonicalJson({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return sha256Hex(new TextEncoder().encode(canonical));
}

async function importSigningKey(identity: IdentityFile): Promise<CryptoKey> {
  if ((await publicKeyId(identity.publicKey)) !== identity.keyId) throw new IdentityFileError("damaged");
  try {
    return await crypto.subtle.importKey("jwk", identity.privateKey, ECDSA_P256, false, ["sign"]);
  } catch {
    throw new IdentityFileError("damaged");
  }
}

function isSignedSessionBody(value: unknown): value is UnisonSignedSessionBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.signature === "string" && !!body.payload && typeof body.payload === "object";
}

// Only the newest attempt saves, so a slow sign-in never replaces the account chosen after it.
async function startSession(signedBody: UnisonSignedSessionBody, attempt: number): Promise<StoredUnisonSession> {
  const response: UnisonSessionResponse = await createSession(signedBody);
  if (attempt !== latestAttempt) throw new SupersededSignInError();
  const session: StoredUnisonSession = {
    token: response.sessionToken,
    expiresAt: response.expiresAt,
    keyId: response.keyId,
    displayName: response.displayName,
    avatarUrl: response.avatarUrl,
  };
  if (!saveUnisonSession(session)) throw new SignInError("failed", "STORAGE_UNAVAILABLE");
  return session;
}

// -- Functions -----------------------------------------------------------------

async function signInWithExtension(extensionId: string): Promise<StoredUnisonSession> {
  const attempt = ++latestAttempt;
  const { nonce } = await fetchChallenge();
  let signedBody: unknown;
  try {
    signedBody = await requestSignedSession(extensionId, nonce);
  } catch (error) {
    if (!(error instanceof ExtensionAuthError)) throw error;
    throw new SignInError(EXTENSION_REASON_KINDS[error.reason] ?? "failed", error.reason);
  }
  if (!isSignedSessionBody(signedBody)) throw new SignInError("failed", "INVALID_RESPONSE");
  return startSession(signedBody, attempt);
}

async function signInWithIdentityFile(file: File): Promise<StoredUnisonSession> {
  const attempt = ++latestAttempt;
  const identity = parseIdentityFile(await file.text());
  const [key, { nonce }] = await Promise.all([importSigningKey(identity), fetchChallenge()]);
  const payload = { origin: window.location.origin, timestamp: Date.now(), nonce, keyId: identity.keyId };
  const signature = await crypto.subtle.sign(ECDSA_SHA256, key, new TextEncoder().encode(canonicalJson(payload)));
  return startSession({ payload, signature: toBase64(signature), publicKey: identity.publicKey }, attempt);
}

// -- Exports -------------------------------------------------------------------

export type { SignInErrorKind };
export { SignInError, SupersededSignInError, signInWithExtension, signInWithIdentityFile };
