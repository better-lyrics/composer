import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useImportFromQuery } from "@/hooks/useImportFromQuery";
import { useImportFromYouTube } from "@/hooks/useImportFromYouTube";
import { INITIAL_STATE, useImportModalStore } from "@/stores/import-modal-store";

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

// -- Tests --------------------------------------------------------------------

describe("useImportFromQuery", () => {
  let handle: MountHandle | null = null;

  beforeEach(() => {
    useImportModalStore.setState({ ...INITIAL_STATE });
    setUrl("");
  });

  afterEach(() => {
    if (handle) {
      handle.unmount();
      handle = null;
    }
    setUrl("");
  });

  it("opens the modal pre-filled with every supported param and strips the consumed five", () => {
    setUrl(
      "?title=Bohemian%20Rhapsody&artist=Queen&album=A%20Night%20at%20the%20Opera&duration=355&videoId=fJ9rUzIMcZQ&isrc=GBUM71029604",
    );

    handle = mountHook();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.prefill).toEqual({
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

  it("opens the modal with only track when only title is present", () => {
    setUrl("?title=Hello");

    handle = mountHook();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.prefill).toEqual({ track: "Hello" });
  });

  it("opens the modal with only videoId when only videoId is present, and leaves videoId in the URL", () => {
    setUrl("?videoId=fJ9rUzIMcZQ");

    handle = mountHook();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.prefill).toEqual({ videoId: "fJ9rUzIMcZQ" });
    expect(new URLSearchParams(currentSearch()).get("videoId")).toBe("fJ9rUzIMcZQ");
  });

  it("ignores a malformed duration but still opens with the other fields, and strips the bad duration from the URL", () => {
    setUrl("?title=Hello&duration=abc");

    handle = mountHook();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.prefill).toEqual({ track: "Hello" });
    expect(new URLSearchParams(currentSearch()).get("duration")).toBeNull();
  });

  it("ignores a malformed ISRC but still applies the rest of the params", () => {
    setUrl("?title=Hello&artist=Adele&isrc=not-an-isrc");

    handle = mountHook();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.prefill).toEqual({ track: "Hello", artist: "Adele" });
    expect(state.prefill?.isrc).toBeUndefined();
  });

  it("no-ops with no params, leaving the modal closed and the URL untouched", () => {
    setUrl("");

    handle = mountHook();

    expect(useImportModalStore.getState().isOpen).toBe(false);
    expect(currentSearch()).toBe("");
  });

  it("treats empty param values as missing and does not open the modal", () => {
    setUrl("?title=&artist=");

    handle = mountHook();

    expect(useImportModalStore.getState().isOpen).toBe(false);
    expect(useImportModalStore.getState().prefill).toBeNull();
  });

  it("decodes percent-encoded values when assigning prefill", () => {
    setUrl("?title=Bohemian%20Rhapsody");

    handle = mountHook();

    expect(useImportModalStore.getState().prefill).toEqual({ track: "Bohemian Rhapsody" });
  });

  it("preserves unrelated query params while stripping the import ones", () => {
    setUrl("?foo=bar&title=Hello");

    handle = mountHook();

    const params = new URLSearchParams(currentSearch());
    expect(params.get("foo")).toBe("bar");
    expect(params.get("title")).toBeNull();
  });

  it("runs once: re-rendering the consumer does not re-open the modal after the user closes it", () => {
    setUrl("?title=Hello");

    handle = mountHook();
    expect(useImportModalStore.getState().isOpen).toBe(true);

    useImportModalStore.getState().close();
    expect(useImportModalStore.getState().isOpen).toBe(false);

    handle.rerender();
    expect(useImportModalStore.getState().isOpen).toBe(false);
  });

  it("normalizes ISRC casing before validating", () => {
    setUrl("?isrc=gbum71029604");

    handle = mountHook();

    expect(useImportModalStore.getState().prefill).toEqual({ isrc: "GBUM71029604" });
  });

  it("rejects a non-positive duration", () => {
    setUrl("?title=Hello&duration=0");

    handle = mountHook();

    expect(useImportModalStore.getState().prefill).toEqual({ track: "Hello" });
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
    useImportModalStore.setState({ ...INITIAL_STATE });
    setUrl("");
  });

  afterEach(() => {
    if (handle) {
      handle.unmount();
      handle = null;
    }
    setUrl("");
  });

  it("captures videoId in the modal prefill before useImportFromYouTube strips it", () => {
    setUrl("?title=Bohemian%20Rhapsody&videoId=fJ9rUzIMcZQ");

    handle = mountBothHooks();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.prefill?.track).toBe("Bohemian Rhapsody");
    expect(state.prefill?.videoId).toBe("fJ9rUzIMcZQ");
    expect(new URLSearchParams(currentSearch()).get("videoId")).toBeNull();
    expect(new URLSearchParams(currentSearch()).get("title")).toBeNull();
  });

  it("opens the modal when only videoId is present, even with YouTube hook also mounted", () => {
    setUrl("?videoId=fJ9rUzIMcZQ");

    handle = mountBothHooks();

    const state = useImportModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.prefill).toEqual({ videoId: "fJ9rUzIMcZQ" });
    expect(new URLSearchParams(currentSearch()).get("videoId")).toBeNull();
  });
});
