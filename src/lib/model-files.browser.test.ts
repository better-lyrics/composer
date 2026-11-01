import { BEAT_MODEL } from "@/audio/beat/beat-model";
import { MODEL_CACHE_NAME } from "@/audio/separation/model-cache";
import { ModelInUseError, listModelFiles, removeModelFiles } from "@/lib/model-files";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { afterEach, describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const ALIGNMENT_URL = "https://models.betterlyrics.org/composer/hubertfa/model.onnx";

// -- Tests --------------------------------------------------------------------

describe("model files", () => {
  afterEach(async () => {
    useBeatDetectionStore.getState().dismiss();
    await caches.delete(MODEL_CACHE_NAME);
  });

  it("lists cached files with their size and removes only the files of one kind", async () => {
    const cache = await caches.open(MODEL_CACHE_NAME);
    await cache.put(BEAT_MODEL.url, new Response(new Uint8Array(1234)));
    await cache.put(ALIGNMENT_URL, new Response(new Uint8Array(56)));
    expect(await listModelFiles()).toContainEqual({ url: BEAT_MODEL.url, bytes: 1234 });

    await removeModelFiles("beat");

    const remaining = await listModelFiles();
    expect(remaining).not.toContainEqual(expect.objectContaining({ url: BEAT_MODEL.url }));
    expect(remaining).toContainEqual({ url: ALIGNMENT_URL, bytes: 56 });
  });

  it("refuses to remove a model while its feature is downloading or running", async () => {
    const cache = await caches.open(MODEL_CACHE_NAME);
    await cache.put(BEAT_MODEL.url, new Response(new Uint8Array(8)));
    useBeatDetectionStore.setState({ status: "detecting" });

    await expect(removeModelFiles("beat")).rejects.toThrow(ModelInUseError);
    expect(await listModelFiles()).toContainEqual({ url: BEAT_MODEL.url, bytes: 8 });
  });
});
