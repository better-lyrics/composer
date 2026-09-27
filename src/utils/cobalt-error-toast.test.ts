import { describe, expect, it } from "vitest";
import { CobaltApiError } from "@/utils/cobalt-api";
import { formatCobaltErrorForToast } from "@/utils/cobalt-error-toast";

describe("formatCobaltErrorForToast", () => {
  const defaultCtx = { isDefault: true, instanceLabel: "Composer" };
  const customCtx = { isDefault: false, instanceLabel: "Woof Monster" };

  const format = (err: unknown, ctx: typeof defaultCtx) => formatCobaltErrorForToast(err, ctx);
  const hintText = (err: unknown, ctx: typeof defaultCtx) => format(err, ctx).hint?.text.toLowerCase() ?? "";

  it("returns a generic message for non-CobaltApiError throwables", () => {
    expect(format(new Error("boom"), defaultCtx)).toEqual({ message: "Couldn't load YouTube audio." });
    expect(format("nope", defaultCtx)).toEqual({ message: "Couldn't load YouTube audio." });
  });

  it("blames the active custom instance by name on empty_audio and suggests switching", () => {
    const result = format(new CobaltApiError("empty_audio", 200), customCtx);
    expect(result.message).toContain("Woof Monster");
    expect(result.hint).toEqual({ text: "Try a different cobalt instance in", setting: "cobaltInstances" });
  });

  it("does not suggest switching for empty_audio on default", () => {
    const result = format(new CobaltApiError("empty_audio", 200), defaultCtx);
    expect(result.hint).toBeUndefined();
    expect(result.message.toLowerCase()).toContain("try again");
  });

  it("calls out the custom instance for bad_response", () => {
    const result = format(new CobaltApiError("bad_response", 200), customCtx);
    expect(result.message).toContain("Woof Monster");
    expect(hintText(new CobaltApiError("bad_response", 200), customCtx)).toContain("different cobalt instance");
  });

  it("explains bot_detection differently for default vs custom", () => {
    const onDefault = format(new CobaltApiError("bot_detection", 0), defaultCtx);
    const onCustom = format(new CobaltApiError("bot_detection", 0), customCtx);
    expect(onDefault.message.toLowerCase()).toContain("youtube");
    expect(onDefault.hint).toEqual({
      text: "Add a working instance from cobalt.directory in",
      setting: "cobaltInstances",
    });
    expect(onCustom.message).toContain("Woof Monster");
    expect(onCustom.hint?.text.toLowerCase()).toContain("different cobalt instance");
  });

  it("explains rate_limited as instance-side on custom", () => {
    expect(format(new CobaltApiError("rate_limited", 429), customCtx).message).toContain("Woof Monster");
  });

  it("treats video-content errors as content issues regardless of instance", () => {
    const result = format(new CobaltApiError("video_unavailable", 0), customCtx);
    expect(result.hint).toBeUndefined();
    expect(result.message.toLowerCase()).toMatch(/private|removed|restricted/);
  });

  it("explains auth_required on custom by suggesting another instance", () => {
    const result = format(new CobaltApiError("auth_required", 401), customCtx);
    expect(result.message).toContain("Woof Monster");
    expect(result.hint?.text.toLowerCase()).toContain("different cobalt instance");
  });

  it("falls back to err.message for unmapped codes", () => {
    const err = new CobaltApiError("totally_made_up", 0);
    expect(format(err, defaultCtx)).toEqual({ message: err.message });
  });

  describe("invariants", () => {
    it("never names the Settings UI in the message", () => {
      for (const code of [
        "empty_audio",
        "bad_response",
        "cobalt_failed",
        "bot_detection",
        "too_long",
        "auth_required",
      ]) {
        for (const ctx of [defaultCtx, customCtx]) {
          expect(format(new CobaltApiError(code, 0), ctx).message).not.toMatch(/Settings/);
        }
      }
    });
  });
});
