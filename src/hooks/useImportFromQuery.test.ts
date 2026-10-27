import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildMetadataFromUrl, useImportFromQuery } from "@/hooks/useImportFromQuery";
import { useImportFromYouTube } from "@/hooks/useImportFromYouTube";
import { getPersistenceSettled, markPersistenceSettled } from "@/lib/persistence-settled";
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

  it("strips the consumed five params from the URL and leaves videoId for the YouTube hook", () => {
    setUrl(
      "?title=Bohemian%20Rhapsody&artist=Queen&album=A%20Night%20at%20the%20Opera&duration=355&videoId=fJ9rUzIMcZQ&isrc=GBUM71029604",
    );

    handle = mountHook();

    const remaining = new URLSearchParams(currentSearch());
    expect(remaining.get("title")).toBeNull();
    expect(remaining.get("artist")).toBeNull();
    expect(remaining.get("album")).toBeNull();
    expect(remaining.get("duration")).toBeNull();
    expect(remaining.get("isrc")).toBeNull();
    expect(remaining.get("videoId")).toBe("fJ9rUzIMcZQ");
  });

  it("leaves videoId in the URL for the YouTube hook when it is the only param", () => {
    setUrl("?videoId=fJ9rUzIMcZQ");

    handle = mountHook();

    expect(new URLSearchParams(currentSearch()).get("videoId")).toBe("fJ9rUzIMcZQ");
  });

  it("leaves the URL untouched with no params", () => {
    setUrl("");

    handle = mountHook();

    expect(currentSearch()).toBe("");
  });

  it("preserves unrelated query params while stripping the import ones", () => {
    setUrl("?foo=bar&title=Hello");

    handle = mountHook();

    const params = new URLSearchParams(currentSearch());
    expect(params.get("foo")).toBe("bar");
    expect(params.get("title")).toBeNull();
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

  it("strips both the song params and the videoId when the YouTube hook is mounted too", () => {
    setUrl("?title=Bohemian%20Rhapsody&videoId=fJ9rUzIMcZQ");

    handle = mountBothHooks();

    expect(new URLSearchParams(currentSearch()).get("videoId")).toBeNull();
    expect(new URLSearchParams(currentSearch()).get("title")).toBeNull();
  });
});
