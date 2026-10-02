import { readStorageEstimate, readStorageProtection, requestStorageProtection } from "@/lib/browser-storage";
import { describe, expect, it } from "vitest";

describe("browser storage", () => {
  it("reads the usage and quota the browser reports", async () => {
    const estimate = await readStorageEstimate();
    expect(estimate).toBeDefined();
    expect(estimate?.quota).toBeGreaterThan(0);
    expect(estimate?.usage).toBeGreaterThanOrEqual(0);
  });

  it("reports protection exactly as the browser does", async () => {
    const persisted = await navigator.storage.persisted();
    expect(await readStorageProtection()).toBe(persisted ? "protected" : "unprotected");
  });

  it("asking for protection returns the browser's answer", async () => {
    const status = await requestStorageProtection();
    const persisted = await navigator.storage.persisted();
    expect(status).toBe(persisted ? "protected" : "unprotected");
  });
});
