import { useAudioStore } from "@/stores/audio";
import { installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import { buildBackgroundVocalTtml, buildSongwriterTtml, buildSyncedTtml } from "@/test/ttml-fixtures";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";
import braccatoTheme from "@/views/preview/braccato-theme.css?raw";
import type { BraccatoLyricsElement } from "@braccato/core/element";
import braccatoLyricsCss from "@braccato/core/styles/lyrics.css?raw";
import { Activity, useState } from "react";
import { describe, expect, it } from "vitest";

let setVisible: (visible: boolean) => void = () => {};

function Harness({ ttml }: { ttml: string }) {
  const [visible, set] = useState(true);
  setVisible = set;
  return (
    <Activity mode={visible ? "visible" : "hidden"}>
      <div style={{ display: "flex", flexDirection: "column", height: 600 }}>
        <BraccatoRenderer ttmlString={ttml} />
      </div>
    </Activity>
  );
}

describe("BraccatoRenderer inside Activity", () => {
  it("U12: revealing the Preview tab reuses the built lyrics view instead of rebuilding it", async () => {
    const screen = await render(<Harness ttml={buildSyncedTtml()} />);
    const el = screen.container.querySelector<BraccatoLyricsElement>("braccato-lyrics");
    if (!el) throw new Error("braccato-lyrics element not rendered");
    await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);
    const proto = Object.getPrototypeOf(el);
    const hostDescriptor = Object.getOwnPropertyDescriptor(proto, "host");
    let hostWrites = 0;
    Object.defineProperty(el, "host", {
      configurable: true,
      get: () => hostDescriptor?.get?.call(el),
      set: (value) => {
        hostWrites++;
        hostDescriptor?.set?.call(el, value);
      },
    });
    const rendererBefore = el.renderer;
    const firstLineBefore = el.querySelector(".blyrics--line");

    setVisible(false);
    await expect.poll(() => screen.container.querySelector<HTMLElement>(":scope > div")?.style.display).toBe("none");
    setVisible(true);
    await expect
      .poll(() => screen.container.querySelector<HTMLElement>(":scope > div")?.style.display)
      .not.toBe("none");
    await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);

    expect(el.renderer).toBe(rendererBefore);
    expect(el.querySelector(".blyrics--line")).toBe(firstLineBefore);
    expect(hostWrites).toBe(0);
  });

  it("regression: lyrics edited while hidden are shown by a fresh renderer, so the active line is placed from scratch", async () => {
    const screen = await render(<Harness ttml={buildSyncedTtml()} />);
    const el = screen.container.querySelector<BraccatoLyricsElement>("braccato-lyrics");
    if (!el) throw new Error("braccato-lyrics element not rendered");
    await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);
    const rendererBefore = el.renderer;

    setVisible(false);
    await expect.poll(() => screen.container.querySelector<HTMLElement>(":scope > div")?.style.display).toBe("none");
    await screen.rerender(<Harness ttml={buildBackgroundVocalTtml()} />);
    setVisible(true);

    await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBe(1);
    expect(el.renderer).not.toBe(rendererBefore);
    expect(el.renderer).not.toBeNull();
  });

  it("still answers line clicks after a hide and reveal", async () => {
    useAudioStore.setState({ audioElement: new Audio() });
    const screen = await render(<Harness ttml={buildSyncedTtml()} />);
    const el = screen.container.querySelector("braccato-lyrics");
    if (!el) throw new Error("braccato-lyrics element not rendered");
    await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);

    setVisible(false);
    await expect.poll(() => screen.container.querySelector<HTMLElement>("div")?.style.display).toBe("none");
    setVisible(true);
    await expect.poll(() => screen.container.querySelector<HTMLElement>("div")?.style.display).not.toBe("none");

    el.querySelector<HTMLElement>(".blyrics--line")?.click();
    await expect.poll(() => useAudioStore.getState().currentTime).toBe(2);
  });

  it("regression: keeps the songwriter credits across a hide, an edit while hidden, and a reveal", async () => {
    const screen = await render(<Harness ttml={buildSongwriterTtml(["Ada"])} />);
    const el = screen.container.querySelector<BraccatoLyricsElement>("braccato-lyrics");
    if (!el) throw new Error("braccato-lyrics element not rendered");
    await expect.poll(() => el.querySelector(".blyrics-credits")?.textContent).toBe("Ada");

    setVisible(false);
    await expect.poll(() => screen.container.querySelector<HTMLElement>(":scope > div")?.style.display).toBe("none");
    await screen.rerender(<Harness ttml={buildSongwriterTtml(["Ada", "Grace"])} />);
    setVisible(true);

    await expect.poll(() => el.querySelector(".blyrics-credits")?.textContent).toBe("Ada & Grace");
  });
});

describe("BraccatoRenderer first rendered hidden", () => {
  it("regression: carries the shared theme before it is ever revealed", async () => {
    const screen = await render(
      <>
        <Activity mode="hidden">
          <div>
            <BraccatoRenderer ttmlString={buildSyncedTtml()} />
          </div>
        </Activity>
        <BraccatoRenderer ttmlString={buildSyncedTtml()} />
      </>,
    );
    const [hidden, visible] = screen.container.querySelectorAll<BraccatoLyricsElement>("braccato-lyrics");
    await expect.poll(() => visible.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);

    await expect.poll(() => hidden.theme).toBe(braccatoTheme);
    expect(hidden.status).not.toBe("theme-conflict");
    expect(visible.status).not.toBe("theme-conflict");
  });
});

describe("BraccatoRenderer lyrics updates", () => {
  it("builds the lines of an edit once, not once for the old lyrics and again for the new", async () => {
    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = screen.container.querySelector<BraccatoLyricsElement>("braccato-lyrics");
    if (!el) throw new Error("braccato-lyrics element not rendered");
    await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);
    const builtLineCounts: number[] = [];
    el.addEventListener("braccato:lyrics-loaded", (event) => {
      const lineCount = (event as CustomEvent<{ lineCount: number }>).detail.lineCount;
      if (lineCount > 0) builtLineCounts.push(lineCount);
    });

    await screen.rerender(<BraccatoRenderer ttmlString={buildBackgroundVocalTtml()} />);

    await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBe(1);
    expect(builtLineCounts).toEqual([1]);
  });

  it("regression: the scroll a lyrics rebuild causes is not reported as the reader scrolling", async () => {
    const layout = installStyleSheet(
      `${braccatoLyricsCss}\nbraccato-lyrics{display:block;overflow-y:auto;height:120px}`,
    );
    try {
      const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
      const el = screen.container.querySelector<BraccatoLyricsElement>("braccato-lyrics");
      if (!el) throw new Error("braccato-lyrics element not rendered");
      await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);
      el.scrollTop = el.scrollHeight;
      await expect.poll(() => el.scrollTop).toBeGreaterThan(0);
      const scrollTopBefore = el.scrollTop;
      let userScrolls = 0;
      const rendererGetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "renderer")?.get;
      Object.defineProperty(el, "renderer", {
        configurable: true,
        get: () => {
          const current = rendererGetter?.call(el);
          if (!current) return current;
          return new Proxy(current, {
            get: (target, key) => {
              if (key === "noteUserScroll") return () => userScrolls++;
              const value = Reflect.get(target, key);
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
        },
      });
      let rebuildScrolled = false;
      el.addEventListener("scroll", () => (rebuildScrolled = true), { once: true });

      await screen.rerender(<BraccatoRenderer ttmlString={buildBackgroundVocalTtml()} />);
      expect(el.scrollTop).not.toBe(scrollTopBefore);
      await expect.poll(() => rebuildScrolled).toBe(true);
      expect(userScrolls).toBe(0);

      el.dispatchEvent(new Event("scroll"));
      expect(userScrolls).toBe(1);
    } finally {
      layout.remove();
    }
  });
});

describe("BraccatoRenderer unmount", () => {
  it("stops listening to the element once the component truly unmounts", async () => {
    useAudioStore.setState({ audioElement: new Audio() });
    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = screen.container.querySelector("braccato-lyrics");
    if (!el) throw new Error("braccato-lyrics element not rendered");
    await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);

    await screen.unmount();
    el.dispatchEvent(new CustomEvent("braccato:line-click", { detail: { timeS: 7 } }));

    expect(useAudioStore.getState().currentTime).toBe(0);
  });
});
