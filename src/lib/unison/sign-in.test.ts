import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalJson } from "@/domain/unison/canonical-json";
import { IdentityFileError } from "@/domain/unison/identity-file";
import type { UnisonSignedSessionBody } from "@/lib/unison/api-types";
import type { ExtensionPort } from "@/lib/unison/extension-port";
import { clearUnisonSession, readUnisonSession } from "@/lib/unison/session";
import { SignInError, signInWithExtension, signInWithIdentityFile } from "@/lib/unison/sign-in";

// -- Helpers -------------------------------------------------------------------

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

const EXPIRES_AT = Math.floor(Date.now() / 1000) + 3600;

function stubUnison(): { sessionBodies: UnisonSignedSessionBody[] } {
  const sessionBodies: UnisonSignedSessionBody[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/auth/challenge"))
      return json({ success: true, data: { nonce: "n".repeat(32), expiresAt: EXPIRES_AT } });
    const body = JSON.parse(String(init.body)) as UnisonSignedSessionBody;
    sessionBodies.push(body);
    return json({
      success: true,
      data: {
        sessionToken: "token-1",
        expiresAt: EXPIRES_AT,
        keyId: body.payload.keyId,
        displayName: "Quiet Otter",
        avatarUrl: null,
        council: null,
      },
    });
  });
  return { sessionBodies };
}

async function identityExport() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const canonical = canonicalJson({ crv: publicKey.crv, kty: publicKey.kty, x: publicKey.x, y: publicKey.y });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const keyId = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { version: 1, keyId, publicKey, privateKey, exportedAt: Date.now(), verifyKey: pair.publicKey };
}

function fileOf(contents: object): File {
  return new File([JSON.stringify(contents)], "identity.json", { type: "application/json" });
}

type PortScript = (port: { reply: (message: unknown) => void; close: () => void }) => void;

function installExtension(script: PortScript): void {
  const connect = (): ExtensionPort => {
    const messageListeners: ((message: unknown) => void)[] = [];
    const disconnectListeners: (() => void)[] = [];
    const controls = {
      reply: (message: unknown) => {
        for (const listener of messageListeners) listener(message);
      },
      close: () => {
        for (const listener of disconnectListeners) listener();
      },
    };
    return {
      onMessage: { addListener: (listener) => messageListeners.push(listener) },
      onDisconnect: { addListener: (listener) => disconnectListeners.push(listener) },
      postMessage: () => queueMicrotask(() => script(controls)),
      disconnect: () => undefined,
    };
  };
  vi.stubGlobal("chrome", { runtime: { connect } });
}

// -- Tests ---------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  clearUnisonSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signInWithIdentityFile", () => {
  it("signs the challenge for this origin and saves the session", async () => {
    const { sessionBodies } = stubUnison();
    const exported = await identityExport();

    const session = await signInWithIdentityFile(fileOf(exported));

    expect(session).toMatchObject({ token: "token-1", keyId: exported.keyId, displayName: "Quiet Otter" });
    expect(readUnisonSession()?.token).toBe("token-1");
    const [body] = sessionBodies;
    expect(body.payload).toMatchObject({
      origin: window.location.origin,
      nonce: "n".repeat(32),
      keyId: exported.keyId,
    });
    const signature = Uint8Array.from(atob(body.signature), (char) => char.charCodeAt(0));
    const verified = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      exported.verifyKey,
      signature,
      new TextEncoder().encode(canonicalJson(body.payload)),
    );
    expect(verified).toBe(true);
  });

  describe("error paths", () => {
    it("rejects a file whose key id does not match its key as damaged", async () => {
      const { sessionBodies } = stubUnison();
      const exported = await identityExport();

      const attempt = signInWithIdentityFile(fileOf({ ...exported, keyId: "b".repeat(64) }));

      await expect(attempt).rejects.toBeInstanceOf(IdentityFileError);
      await expect(attempt).rejects.toMatchObject({ kind: "damaged" });
      expect(sessionBodies).toHaveLength(0);
      expect(readUnisonSession()).toBeNull();
    });
  });

  describe("invariants", () => {
    it("never stores the private key", async () => {
      stubUnison();
      const exported = await identityExport();

      await signInWithIdentityFile(fileOf(exported));

      const stored = Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? "");
      expect(stored.some((value) => value.includes(String(exported.privateKey.d)))).toBe(false);
    });
  });
});

describe("signInWithExtension", () => {
  describe("error paths", () => {
    it("reports a closed prompt as cancelled", async () => {
      stubUnison();
      installExtension((port) => port.close());

      const attempt = signInWithExtension("ext");

      await expect(attempt).rejects.toBeInstanceOf(SignInError);
      await expect(attempt).rejects.toMatchObject({ kind: "cancelled" });
      expect(readUnisonSession()).toBeNull();
    });
  });
});
