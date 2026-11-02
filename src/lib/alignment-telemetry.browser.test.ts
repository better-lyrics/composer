import type { SegmentAlignment } from "@/audio/alignment/types";
import type { LyricLine } from "@/domain/line/model";
import { type AlignedRunLine, collectAlignedRun, sendAlignmentTelemetry } from "@/lib/alignment-telemetry";
import { setAlignmentSharing } from "@/lib/alignment-telemetry-consent";
import { readProjectTelemetry } from "@/lib/alignment-telemetry-storage";
import { adoptOpenProjectId } from "@/lib/open-project-session";
import { useAlignmentTelemetryStore } from "@/stores/alignment-telemetry";
import { useProjectStore } from "@/stores/project";
import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const ENDPOINT = "https://telemetry.test";

const RESULT: SegmentAlignment = {
  intervals: [],
  fellBack: false,
  unknownWords: [],
  guessedWords: [],
  splits: [],
  anchor: null,
};

function alignedLine(line: LyricLine): AlignedRunLine {
  return {
    line,
    taps: { begin: 1, end: 2 },
    window: { begin: 0.4, end: 2.15 },
    result: RESULT,
    timings: [{ text: line.text, begin: 1.1, end: 1.6 }],
  };
}

async function collectFor(projectId: string, line: LyricLine): Promise<void> {
  adoptOpenProjectId(projectId);
  collectAlignedRun({ modelId: "hubertfa-v007", language: "en", realign: false, lines: [alignedLine(line)] });
  await expect.poll(async () => (await readProjectTelemetry(projectId))?.lines[line.id]).toBeDefined();
}

// -- Setup --------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("VITE_ALIGNMENT_TELEMETRY_URL", ENDPOINT);
  // The telemetry endpoint is an outside service; nothing here reaches it.
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// -- Tests --------------------------------------------------------------------

describe("alignment telemetry", () => {
  it("keeps aligned lines on this device and sends them only on export, once per timing", async () => {
    const line = createLine({ id: "l1", text: "hello" });
    await collectFor("project-a", line);
    expect((await readProjectTelemetry("project-a"))?.lines.l1.aligned).toEqual([
      { text: "hello", begin: 1.1, end: 1.6 },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();

    const exported = createLine({ id: "l1", text: "hello", words: [{ text: "hello", begin: 1.25, end: 1.7 }] });
    useProjectStore.setState({
      lines: [exported],
      metadata: { ...useProjectStore.getState().metadata, title: "Song" },
    });
    sendAlignmentTelemetry({ ttml: "<tt/>", youtubeVideoId: "dQw4w9WgXcQ" });
    await expect.poll(() => fetchMock.mock.calls.length).toBe(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENDPOINT}/v1/telemetry`);
    const body = JSON.parse(init.body as string);
    expect(body.installId).toBe(useAlignmentTelemetryStore.getState().installId);
    expect(body.song).toMatchObject({ title: "Song", videoId: "dQw4w9WgXcQ" });
    expect(body.lines[0].final).toEqual([{ text: "hello", begin: 1.25, end: 1.7 }]);
    await expect.poll(async () => (await readProjectTelemetry("project-a"))?.lastSent).toBeDefined();

    sendAlignmentTelemetry({ ttml: "<tt/>", youtubeVideoId: "dQw4w9WgXcQ" });
    await expect.poll(async () => (await readProjectTelemetry("project-a"))?.lastSent).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps nothing while sharing is off", async () => {
    useAlignmentTelemetryStore.setState({ enabled: false });
    adoptOpenProjectId("project-off");
    collectAlignedRun({
      modelId: "hubertfa-v007",
      language: "en",
      realign: false,
      lines: [alignedLine(createLine({ id: "l1", text: "hello" }))],
    });
    sendAlignmentTelemetry({ ttml: "<tt/>", youtubeVideoId: undefined });
    expect(await readProjectTelemetry("project-off")).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turning sharing off deletes every project's data and asks the server to delete what was sent", async () => {
    await collectFor("project-a", createLine({ id: "a1", text: "one" }));
    await collectFor("project-b", createLine({ id: "b1", text: "two" }));
    useAlignmentTelemetryStore.setState({ sentUnderId: true });
    const sentId = useAlignmentTelemetryStore.getState().installId;

    await setAlignmentSharing(false);

    expect(await readProjectTelemetry("project-a")).toBeUndefined();
    expect(await readProjectTelemetry("project-b")).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(`${ENDPOINT}/v1/telemetry/${sentId}`, { method: "DELETE" });
    const after = useAlignmentTelemetryStore.getState();
    expect(after).toMatchObject({ enabled: false, sentUnderId: false, pendingDeletes: [] });
    expect(after.installId).not.toBe(sentId);
  });

  it("keeps a failed server delete and retries it", async () => {
    useAlignmentTelemetryStore.setState({ sentUnderId: true });
    const sentId = useAlignmentTelemetryStore.getState().installId;
    allowConsole(/couldn't delete sent telemetry/);
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await setAlignmentSharing(false);
    expect(useAlignmentTelemetryStore.getState().pendingDeletes).toEqual([sentId]);
    await setAlignmentSharing(false);
    expect(useAlignmentTelemetryStore.getState().pendingDeletes).toEqual([]);
    expect(fetchMock).toHaveBeenLastCalledWith(`${ENDPOINT}/v1/telemetry/${sentId}`, { method: "DELETE" });
  });

  it("stays off after a reload once unchecked", async () => {
    await setAlignmentSharing(false);
    const stored = JSON.parse(localStorage.getItem("composer-alignment-telemetry") ?? "{}");
    expect(stored.state.enabled).toBe(false);
    await useAlignmentTelemetryStore.persist.rehydrate();
    expect(useAlignmentTelemetryStore.getState().enabled).toBe(false);
  });
});
