import { describe, expect, it } from "vitest";
import { BridgeError, formatBridgeErrorForToast, isBridgeUnreachable } from "@/utils/composer-bridge-api";

// -- BridgeError --------------------------------------------------------------

describe("BridgeError", () => {
  it("stores code, message, and optional status", () => {
    const err = new BridgeError("http", "bridge audio: 502", 502);
    expect(err.code).toBe("http");
    expect(err.message).toBe("bridge audio: 502");
    expect(err.status).toBe(502);
    expect(err.name).toBe("BridgeError");
  });

  it("works without a status", () => {
    const err = new BridgeError("unreachable", "connection refused");
    expect(err.code).toBe("unreachable");
    expect(err.status).toBeUndefined();
  });

  it("is throwable and instanceof Error", () => {
    expect(() => {
      throw new BridgeError("empty", "no audio");
    }).toThrow(BridgeError);
    try {
      throw new BridgeError("empty", "no audio");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(BridgeError);
    }
  });
});

// -- formatBridgeErrorForToast ------------------------------------------------

describe("formatBridgeErrorForToast", () => {
  it("returns a start-the-bridge message for 'unreachable'", () => {
    const msg = formatBridgeErrorForToast(new BridgeError("unreachable", "ECONNREFUSED"));
    expect(msg).toMatch(/Composer Bridge is not running/);
  });

  it("returns a timeout message for 'timeout'", () => {
    const msg = formatBridgeErrorForToast(new BridgeError("timeout", "deadline exceeded"));
    expect(msg).toMatch(/timed out/);
  });

  it("returns a 'try a different video' message for 'empty'", () => {
    const msg = formatBridgeErrorForToast(new BridgeError("empty", "no bytes"));
    expect(msg).toMatch(/Try a different video/);
  });

  it("includes the HTTP status for 'http' errors", () => {
    const msg = formatBridgeErrorForToast(new BridgeError("http", "bad gateway", 502));
    expect(msg).toMatch(/502/);
  });

  it("returns 'unknown' for non-BridgeError exceptions", () => {
    expect(formatBridgeErrorForToast(new Error("boom"))).toMatch(/unknown reason/);
    expect(formatBridgeErrorForToast("string error")).toMatch(/unknown reason/);
    expect(formatBridgeErrorForToast(null)).toMatch(/unknown reason/);
  });
});

// -- isBridgeUnreachable -------------------------------------------------------

describe("isBridgeUnreachable", () => {
  it.each([
    { name: "a BridgeError with code 'unreachable'", error: new BridgeError("unreachable", "down"), expected: true },
    { name: "a BridgeError with code 'timeout'", error: new BridgeError("timeout", "slow"), expected: false },
    { name: "a BridgeError with code 'http'", error: new BridgeError("http", "502", 502), expected: false },
    { name: "a plain Error named 'unreachable'", error: new Error("unreachable"), expected: false },
    { name: "undefined", error: undefined, expected: false },
  ])("is $expected for $name", ({ error, expected }) => {
    expect(isBridgeUnreachable(error)).toBe(expected);
  });
});
