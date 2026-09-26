import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildMetadataFromUrl, useImportFromQuery } from "@/hooks/useImportFromQuery";
import { useImportFromYouTube } from "@/hooks/useImportFromYouTube";
import { getPersistenceSettled, markPersistenceSettled } from "@/lib/persistence-settled";
import { INITIAL_STATE, useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// -- Harness ------------------------------------------------------------------

interface MountHandle {
  container: HTMLDivElement;
  root: Root;
  rerender: () => void;
  unmount: () => void;
}

const HookHost: React.FC = () => {
  useImportFromQuery();
  return null;
};

function mountHook(): MountHandle {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(HookHost));
  });
  return {
    container,
    root,
    rerender: () => {
      act(() => {
        root.render(createElement(HookHost));
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function setUrl(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

function currentSearch(): string {
  return window.location.search;
}

function resetStore(): void {
  useImportModalStore.setState({ ...INITIAL_STATE });
  window.localStorage.removeItem("composer-import-modal");
  useProjectStore.getState().reset();
}

// -- Tests --------------------------------------------------------------------

describe("useImportFromQuery", () => {
  let handle: MountHandle | null = null;

  beforeEach(() => {
    resetStore();
    setUrl("");
  });

  afterEach(() => {
    if (handle) {
      handle.unmount();
      handle = null;
    }
    setUrl("");
  });

  it("stashes every supported param into defaultPrefill and strips the consumed five from the URL", () => {
    setUrl(
      "?title=Bohemian%20Rhapsody&artist=Queen&album=A%20Night%20at%20the%20Opera&duration=355&videoId=fJ9rUzIMcZQ&isrc=GBUM71029604",
    );

    handle = mountHook();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.defaultPrefill).toEqual({
      track: "Bohemian Rhapsody",
      artist: "Queen",
      album: "A Night at the Opera",
      durationSec: 355,
      videoId: "fJ9rUzIMcZQ",
      isrc: "GBUM71029604",
    });
    const remaining = new URLSearchParams(currentSearch());
    expect(remaining.get("title")).toBeNull();
    expect(remaining.get("artist")).toBeNull();
    expect(remaining.get("album")).toBeNull();
    expect(remaining.get("duration")).toBeNull();
    expect(remaining.get("isrc")).toBeNull();
    expect(remaining.get("videoId")).toBe("fJ9rUzIMcZQ");
  });

  it("stashes only track when only title is present, leaves modal closed", () => {
    setUrl("?title=Hello");

    handle = mountHook();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.defaultPrefill).toEqual({ track: "Hello" });
  });

  it("stashes only videoId when only videoId is present, and leaves videoId in the URL for the YouTube hook", () => {
    setUrl("?videoId=fJ9rUzIMcZQ");

    handle = mountHook();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.defaultPrefill).toEqual({ videoId: "fJ9rUzIMcZQ" });
    expect(new URLSearchParams(currentSearch()).get("videoId")).toBe("fJ9rUzIMcZQ");
  });

  it("ignores a malformed duration but still stashes the other fields, and strips the bad duration from the URL", () => {
    setUrl("?title=Hello&duration=abc");

    handle = mountHook();

    const state = useImportModalStore.getState();
    expect(state.defaultPrefill).toEqual({ track: "Hello" });
    expect(new URLSearchParams(currentSearch()).get("duration")).toBeNull();
  });

  it("ignores a malformed ISRC but still applies the rest of the params", () => {
    setUrl("?title=Hello&artist=Adele&isrc=not-an-isrc");

    handle = mountHook();

    const state = useImportModalStore.getState();
    expect(state.defaultPrefill).toEqual({ track: "Hello", artist: "Adele" });
    expect(state.defaultPrefill?.isrc).toBeUndefined();
  });

  it("no-ops with no params, leaving the modal closed and the URL untouched", () => {
    setUrl("");

    handle = mountHook();

    expect(useImportModalStore.getState().isOpen).toBe(false);
    expect(useImportModalStore.getState().defaultPrefill).toBeNull();
    expect(currentSearch()).toBe("");
  });

  it("treats empty param values as missing and leaves defaultPrefill null", () => {
    setUrl("?title=&artist=");

    handle = mountHook();

    expect(useImportModalStore.getState().defaultPrefill).toBeNull();
  });

  it("decodes percent-encoded values when stashing defaultPrefill", () => {
    setUrl("?title=Bohemian%20Rhapsody");

    handle = mountHook();

    expect(useImportModalStore.getState().defaultPrefill).toEqual({ track: "Bohemian Rhapsody" });
  });

  it("preserves unrelated query params while stripping the import ones", () => {
    setUrl("?foo=bar&title=Hello");

    handle = mountHook();

    const params = new URLSearchParams(currentSearch());
    expect(params.get("foo")).toBe("bar");
    expect(params.get("title")).toBeNull();
  });

  it("does not auto-open the modal even when params are present", () => {
    setUrl("?title=Hello");

    handle = mountHook();

    expect(useImportModalStore.getState().isOpen).toBe(false);
  });

  it("normalizes ISRC casing before validating", () => {
    setUrl("?isrc=gbum71029604");

    handle = mountHook();

    expect(useImportModalStore.getState().defaultPrefill).toEqual({ isrc: "GBUM71029604" });
  });

  it("rejects a non-positive duration", () => {
    setUrl("?title=Hello&duration=0");

    handle = mountHook();

    expect(useImportModalStore.getState().defaultPrefill).toEqual({ track: "Hello" });
  });

  it("open() without explicit prefill falls back to defaultPrefill", () => {
    setUrl("?title=Hello&artist=World");

    handle = mountHook();

    useImportModalStore.getState().open();
    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.prefill).toEqual({ track: "Hello", artist: "World" });
  });

  it("explicit prefill on open() overrides the stashed defaultPrefill", () => {
    setUrl("?title=Hello");

    handle = mountHook();

    useImportModalStore.getState().open({ prefill: { track: "Custom" } });
    const state = useImportModalStore.getState();
    expect(state.prefill).toEqual({ track: "Custom" });
    expect(state.defaultPrefill).toEqual({ track: "Hello" });
  });

  it("clearDefaultPrefill removes the stashed values", () => {
    setUrl("?title=Hello");

    handle = mountHook();

    expect(useImportModalStore.getState().defaultPrefill).toEqual({ track: "Hello" });
    useImportModalStore.getState().clearDefaultPrefill();
    expect(useImportModalStore.getState().defaultPrefill).toBeNull();
  });
});

describe("buildMetadataFromUrl", () => {
  it("persists title/artists/album/isrc/duration from the enriched link", () => {
    const out = buildMetadataFromUrl(new URLSearchParams("title=T&artist=A&album=Al&isrc=usqx91700001&duration=200"));
    expect(out).toEqual({ title: "T", artists: ["A"], album: "Al", isrc: "USQX91700001", duration: 200 });
  });
  it("returns null when no fields present", () => {
    expect(buildMetadataFromUrl(new URLSearchParams(""))).toBeNull();
  });
  it("drops an invalid isrc but keeps the rest", () => {
    expect(buildMetadataFromUrl(new URLSearchParams("title=T&isrc=bad"))).toEqual({ title: "T" });
  });
  it("omits absent fields (no empty strings or zero duration)", () => {
    expect(buildMetadataFromUrl(new URLSearchParams("artist=A"))).toEqual({ artists: ["A"] });
  });
});

async function flushSettled(): Promise<void> {
  markPersistenceSettled();
  await act(async () => {
    await getPersistenceSettled();
  });
}

describe("useImportFromQuery persists enriched-link metadata", () => {
  let handle: MountHandle | null = null;

  beforeEach(() => {
    resetStore();
    setUrl("");
  });

  afterEach(() => {
    if (handle) {
      handle.unmount();
      handle = null;
    }
    setUrl("");
  });

  it("writes title/artists/album/isrc/duration into the project store once persistence settles", async () => {
    setUrl("?title=Hello&artist=Adele&album=25&isrc=gbum71029604&duration=355");

    handle = mountHook();
    await flushSettled();

    expect(useProjectStore.getState().metadata).toMatchObject({
      title: "Hello",
      artists: ["Adele"],
      album: "25",
      isrc: "GBUM71029604",
      duration: 355,
    });
  });

  it("leaves project metadata untouched when no import params are present", async () => {
    setUrl("?foo=bar");

    handle = mountHook();
    await flushSettled();

    expect(useProjectStore.getState().metadata).toEqual({
      title: "",
      artists: [],
      album: "",
      duration: 0,
    });
  });

  it("does not write a metadata patch when only videoId is present", async () => {
    setUrl("?videoId=fJ9rUzIMcZQ");

    handle = mountHook();
    await flushSettled();

    expect(useProjectStore.getState().metadata).toEqual({
      title: "",
      artists: [],
      album: "",
      duration: 0,
    });
  });
});

// -- Boot race: gate the project write behind persistence settling ------------

describe("useImportFromQuery gates the metadata write behind persistence", () => {
  let handle: MountHandle | null = null;

  beforeEach(() => {
    resetStore();
    setUrl("");
  });

  afterEach(() => {
    if (handle) {
      handle.unmount();
      handle = null;
    }
    setUrl("");
  });

  it("does not write enriched-link metadata until persistence has settled", () => {
    setUrl("?title=Hello&artist=Adele&album=25&isrc=gbum71029604&duration=355");

    handle = mountHook();

    expect(useProjectStore.getState().metadata).toEqual({
      title: "",
      artists: [],
      album: "",
      duration: 0,
    });
  });

  it("applies the enriched-link metadata after persistence settles", async () => {
    setUrl("?title=Hello&artist=Adele&album=25&isrc=gbum71029604&duration=355");

    handle = mountHook();
    await flushSettled();

    expect(useProjectStore.getState().metadata).toMatchObject({
      title: "Hello",
      artists: ["Adele"],
      album: "25",
      isrc: "GBUM71029604",
      duration: 355,
    });
  });

  it("does not clobber a persistence-restored project when the URL has no import params", async () => {
    setUrl("?foo=bar");
    useProjectStore.getState().setMetadata({
      title: "Restored Title",
      artists: ["Restored Artist"],
      album: "Restored Album",
      isrc: "USQX91700001",
      duration: 200,
    });

    handle = mountHook();
    await flushSettled();

    expect(useProjectStore.getState().metadata).toMatchObject({
      title: "Restored Title",
      artists: ["Restored Artist"],
      album: "Restored Album",
      isrc: "USQX91700001",
      duration: 200,
    });
  });

  it("does not write after unmount even once persistence settles", async () => {
    setUrl("?title=Hello&artist=Adele");

    handle = mountHook();
    handle.unmount();
    handle = null;
    await flushSettled();

    expect(useProjectStore.getState().metadata).toEqual({
      title: "",
      artists: [],
      album: "",
      duration: 0,
    });
  });
});

// -- Regression: hook order in App.tsx ----------------------------------------

const BothHooksHost: React.FC = () => {
  useImportFromQuery();
  useImportFromYouTube();
  return null;
};

function mountBothHooks(): MountHandle {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(BothHooksHost));
  });
  return {
    container,
    root,
    rerender: () => {
      act(() => {
        root.render(createElement(BothHooksHost));
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useImportFromQuery + useImportFromYouTube mounted together", () => {
  let handle: MountHandle | null = null;

  beforeEach(() => {
    resetStore();
    setUrl("");
  });

  afterEach(() => {
    if (handle) {
      handle.unmount();
      handle = null;
    }
    setUrl("");
  });

  it("captures videoId in defaultPrefill before useImportFromYouTube strips it", () => {
    setUrl("?title=Bohemian%20Rhapsody&videoId=fJ9rUzIMcZQ");

    handle = mountBothHooks();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.defaultPrefill?.track).toBe("Bohemian Rhapsody");
    expect(state.defaultPrefill?.videoId).toBe("fJ9rUzIMcZQ");
    expect(new URLSearchParams(currentSearch()).get("videoId")).toBeNull();
    expect(new URLSearchParams(currentSearch()).get("title")).toBeNull();
  });

  it("stashes videoId in defaultPrefill when only videoId is present, even with YouTube hook also mounted", () => {
    setUrl("?videoId=fJ9rUzIMcZQ");

    handle = mountBothHooks();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.defaultPrefill).toEqual({ videoId: "fJ9rUzIMcZQ" });
    expect(new URLSearchParams(currentSearch()).get("videoId")).toBeNull();
  });
});
