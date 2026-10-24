import { firstLaunchedFile, launchTargetAction, launchedFileKind } from "@/lib/launched-file";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function named(name: string, type = ""): File {
  return new File(["x"], name, { type });
}

function url(path: string): URL {
  return new URL(path, "https://composer.boidu.dev");
}

// -- Tests --------------------------------------------------------------------

describe("launchedFileKind", () => {
  it("routes project files, lyrics and audio to their owners", () => {
    expect(launchedFileKind(named("Lust for Life-2026-10-25.composer"))).toBe("project");
    expect(launchedFileKind(named("composer-backup-2026-10-25.composer"))).toBe("project");
    expect(launchedFileKind(named("old.ttml-project.json"))).toBe("project");
    expect(launchedFileKind(named("anything.json"))).toBe("project");
    expect(launchedFileKind(named("song.ttml"))).toBe("lyrics");
    expect(launchedFileKind(named("song.LRC"))).toBe("lyrics");
    expect(launchedFileKind(named("song.qrc"))).toBe("lyrics");
    expect(launchedFileKind(named("song.flac", "audio/flac"))).toBe("audio");
  });

  it("refuses files no owner reads", () => {
    expect(launchedFileKind(named("notes.pdf"))).toBeNull();
  });
});

describe("firstLaunchedFile", () => {
  it("takes the first usable file and counts the rest as skipped", () => {
    const picked = firstLaunchedFile([named("a.pdf"), named("b.lrc"), named("c.mp3", "audio/mpeg")]);
    expect(picked?.file.name).toBe("b.lrc");
    expect(picked?.kind).toBe("lyrics");
    expect(picked?.skipped).toBe(2);
  });

  it("returns null when nothing is usable", () => {
    expect(firstLaunchedFile([named("a.pdf")])).toBeNull();
  });
});

describe("launchTargetAction", () => {
  it("ignores the launch that opened the window, boot already handled it", () => {
    expect(launchTargetAction(url("/editor?v=dQw4w9WgXcQ"), true)).toEqual({ kind: "ignore" });
  });

  it("reloads into a later song link so boot applies it", () => {
    expect(launchTargetAction(url("/?v=dQw4w9WgXcQ"), false)).toEqual({ kind: "reload" });
    expect(launchTargetAction(url("/#import=%7B%7D"), false)).toEqual({ kind: "reload" });
  });

  it("navigates in place for a later plain launch such as a dock shortcut", () => {
    expect(launchTargetAction(url("/editor"), false)).toEqual({ kind: "navigate", path: "/editor" });
  });
});
