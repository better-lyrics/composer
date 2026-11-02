import { describe, expect, it } from "vitest";
import { canonicalJson } from "@/domain/unison/canonical-json";
import { IdentityFileError, parseIdentityFile } from "@/domain/unison/identity-file";

// -- Helpers -------------------------------------------------------------------

async function exportedIdentity() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { version: 1, keyId: "a".repeat(64), publicKey, privateKey, exportedAt: Date.now() };
}

function kindOf(text: string): string | null {
  try {
    parseIdentityFile(text);
    return null;
  } catch (error) {
    return error instanceof IdentityFileError ? error.kind : "other";
  }
}

// -- Tests ---------------------------------------------------------------------

describe("parseIdentityFile", () => {
  it("reads a version 1 export", async () => {
    const exported = await exportedIdentity();
    const identity = parseIdentityFile(JSON.stringify(exported));
    expect(identity).toEqual({ keyId: exported.keyId, publicKey: exported.publicKey, privateKey: exported.privateKey });
  });

  describe("error paths", () => {
    it("rejects text that is not JSON", () => {
      expect(kindOf("not json")).toBe("not-identity");
    });

    it("rejects JSON that is not an export object", () => {
      expect(kindOf("[]")).toBe("not-identity");
      expect(kindOf("null")).toBe("not-identity");
    });

    it("rejects other versions, short key ids and missing private parts", async () => {
      const exported = await exportedIdentity();
      expect(kindOf(JSON.stringify({ ...exported, version: 2 }))).toBe("not-identity");
      expect(kindOf(JSON.stringify({ ...exported, keyId: "abc" }))).toBe("not-identity");
      expect(kindOf(JSON.stringify({ ...exported, privateKey: { ...exported.privateKey, d: undefined } }))).toBe(
        "not-identity",
      );
      expect(kindOf(JSON.stringify({ ...exported, publicKey: { ...exported.publicKey, crv: "P-384" } }))).toBe(
        "not-identity",
      );
    });

    it("reports a private key that does not match the public key as damaged", async () => {
      const exported = await exportedIdentity();
      const other = await exportedIdentity();
      expect(kindOf(JSON.stringify({ ...exported, privateKey: other.privateKey }))).toBe("damaged");
    });
  });
});

describe("canonicalJson", () => {
  it("sorts keys at every depth and drops undefined values", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: 2 } })).toBe('{"a":{"c":2},"b":1}');
  });

  describe("regressions", () => {
    it("regression: orders integer-like keys as strings, like the server", () => {
      expect(canonicalJson({ 2: "b", 10: "a" })).toBe('{"10":"a","2":"b"}');
    });
  });

  describe("invariants", () => {
    it("is independent of key insertion order", () => {
      expect(canonicalJson({ x: 1, y: [{ b: 1, a: 2 }] })).toBe(canonicalJson({ y: [{ a: 2, b: 1 }], x: 1 }));
    });
  });
});
