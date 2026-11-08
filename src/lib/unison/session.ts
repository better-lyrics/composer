// -- Types ---------------------------------------------------------------------

interface StoredUnisonSession {
  token: string;
  expiresAt: number;
  keyId: string;
  displayName: string;
  avatarUrl: string | null;
}

type SessionListener = () => void;

interface SessionSnapshot {
  raw: string | null;
  session: StoredUnisonSession | null;
}

// -- Constants -----------------------------------------------------------------

const UNISON_SESSION_STORAGE_KEY = "composer.unison.session.v1";
const LOG_PREFIX = "[UnisonSession]";

// -- State ---------------------------------------------------------------------

const listeners = new Set<SessionListener>();
let cachedSnapshot: SessionSnapshot = { raw: null, session: null };

// -- Storage -------------------------------------------------------------------

function readRaw(): string | null {
  try {
    return localStorage.getItem(UNISON_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn(`${LOG_PREFIX} Could not read the saved session`, error);
    return null;
  }
}

function writeRaw(raw: string | null): boolean {
  try {
    if (raw === null) localStorage.removeItem(UNISON_SESSION_STORAGE_KEY);
    else localStorage.setItem(UNISON_SESSION_STORAGE_KEY, raw);
    return true;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Could not ${raw === null ? "remove" : "save"} the session`, error);
    return false;
  }
}

// -- Parsing -------------------------------------------------------------------

function isStoredUnisonSession(value: unknown): value is StoredUnisonSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    typeof candidate.expiresAt === "number" &&
    Number.isFinite(candidate.expiresAt) &&
    typeof candidate.keyId === "string" &&
    typeof candidate.displayName === "string" &&
    (candidate.avatarUrl === null || typeof candidate.avatarUrl === "string")
  );
}

function parseSession(raw: string): StoredUnisonSession | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStoredUnisonSession(parsed)) return parsed;
    console.warn(`${LOG_PREFIX} Saved session has an unknown shape, signing out`);
  } catch (error) {
    console.warn(`${LOG_PREFIX} Saved session is not valid JSON, signing out`, error);
  }
  return null;
}

// Unison sends expiresAt in unix seconds.
function isExpired(session: StoredUnisonSession): boolean {
  return session.expiresAt * 1000 <= Date.now();
}

// -- Functions -----------------------------------------------------------------

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

function readUnisonSession(): StoredUnisonSession | null {
  const raw = readRaw();
  if (raw !== cachedSnapshot.raw) {
    cachedSnapshot = { raw, session: raw === null ? null : parseSession(raw) };
    if (raw !== null && cachedSnapshot.session === null) {
      writeRaw(null);
      cachedSnapshot = { raw: null, session: null };
    }
  }
  if (cachedSnapshot.session && isExpired(cachedSnapshot.session)) {
    writeRaw(null);
    cachedSnapshot = { raw: null, session: null };
  }
  return cachedSnapshot.session;
}

function saveUnisonSession(session: StoredUnisonSession): boolean {
  const saved = writeRaw(JSON.stringify(session));
  notifyListeners();
  return saved;
}

function clearUnisonSession(): void {
  writeRaw(null);
  notifyListeners();
}

function handleStorageEvent(event: StorageEvent): void {
  if (event.key === UNISON_SESSION_STORAGE_KEY || event.key === null) notifyListeners();
}

function subscribeUnisonSession(listener: SessionListener): () => void {
  if (listeners.size === 0) window.addEventListener("storage", handleStorageEvent);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", handleStorageEvent);
  };
}

// -- Exports -------------------------------------------------------------------

export type { StoredUnisonSession };
export { clearUnisonSession, readUnisonSession, saveUnisonSession, subscribeUnisonSession, UNISON_SESSION_STORAGE_KEY };
