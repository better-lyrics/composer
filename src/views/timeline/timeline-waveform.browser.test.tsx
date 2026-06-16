import { afterEach, describe, expect, it } from "vitest";
import { TimelineWaveform } from "@/views/timeline/timeline-waveform";
import { useAudioStore } from "@/stores/audio";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { readToken } from "@/utils/theme/read-token";
import { TOKEN_VAR } from "@/domain/theme/model";

function setupWaveformAudio(duration = 30) {
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration,
  });
}

describe("TimelineWaveform", () => {
  it("renders nothing when there is no audio source", async () => {
    useAudioStore.setState({ source: null });
    await render(<TimelineWaveform />);
    expect(document.querySelector(".sticky")).toBeNull();
  });

  it("renders the sticky waveform container when an audio source exists", async () => {
    setupWaveformAudio();
    await render(<TimelineWaveform />);
    expect(document.querySelector(".sticky")).not.toBeNull();
  });

  it("sizes the click overlay to duration × zoom", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50 });
    const screen = await render(<TimelineWaveform />);
    const clickLayer = screen.container.querySelector(".cursor-pointer") as HTMLElement;
    expect(clickLayer).not.toBeNull();
    expect(clickLayer.style.width).toBe("1500px");
  });

  it("seeks to the clicked time on the waveform", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50 });
    let seeked = -1;
    useAudioStore.setState({
      seekTo: (time: number) => {
        seeked = time;
      },
    } as Parameters<typeof useAudioStore.setState>[0]);
    const screen = await render(<TimelineWaveform />);
    const clickLayer = screen.container.querySelector(".cursor-pointer") as HTMLElement;
    Object.defineProperty(clickLayer, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        right: 1500,
        bottom: 80,
        width: 1500,
        height: 80,
        x: 0,
        y: 0,
        toJSON: () => "",
      }),
    });
    clickLayer.dispatchEvent(new MouseEvent("click", { clientX: 750, clientY: 40, bubbles: true }));
    expect(seeked).toBeCloseTo(15, 3);
  });

  it("does NOT call seekTo when duration is zero", async () => {
    setupWaveformAudio(0);
    let seeked = -1;
    useAudioStore.setState({
      seekTo: (time: number) => {
        seeked = time;
      },
    } as Parameters<typeof useAudioStore.setState>[0]);
    const screen = await render(<TimelineWaveform />);
    const clickLayer = screen.container.querySelector(".cursor-pointer") as HTMLElement | null;
    clickLayer?.dispatchEvent(new MouseEvent("click", { clientX: 100, clientY: 40, bubbles: true }));
    expect(seeked).toBe(-1);
  });

  it("clamps the seek time to the duration when clicked past the right edge", async () => {
    setupWaveformAudio(20);
    useTimelineStore.setState({ zoom: 50 });
    let seeked = -1;
    useAudioStore.setState({
      seekTo: (time: number) => {
        seeked = time;
      },
    } as Parameters<typeof useAudioStore.setState>[0]);
    const screen = await render(<TimelineWaveform />);
    const clickLayer = screen.container.querySelector(".cursor-pointer") as HTMLElement;
    const width = 20 * 50;
    Object.defineProperty(clickLayer, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: width, bottom: 80, width, height: 80, x: 0, y: 0, toJSON: () => "" }),
    });
    clickLayer.dispatchEvent(new MouseEvent("click", { clientX: width, clientY: 40, bubbles: true }));
    expect(seeked).toBeCloseTo(20, 3);
  });
});

describe("TimelineWaveform theme tokens", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty(TOKEN_VAR.wave);
    document.documentElement.style.removeProperty(TOKEN_VAR["wave-progress"]);
  });

  it("reads the wave and wave-progress tokens set on documentElement", async () => {
    document.documentElement.style.setProperty(TOKEN_VAR.wave, "#abcdef");
    document.documentElement.style.setProperty(TOKEN_VAR["wave-progress"], "#012345");
    expect(readToken("wave")).toBe("#abcdef");
    expect(readToken("wave-progress")).toBe("#012345");
  });

  it("renders without error when wave tokens are overridden", async () => {
    document.documentElement.style.setProperty(TOKEN_VAR.wave, "#abcdef");
    document.documentElement.style.setProperty(TOKEN_VAR["wave-progress"], "#012345");
    setupWaveformAudio(30);
    useAudioStore.setState({ audioElement: new Audio() });
    const screen = await render(<TimelineWaveform />);
    expect(screen.container.querySelector(".sticky")).not.toBeNull();
  });
});

describe("TimelineWaveform redraw background", () => {
  function getBackground(): HTMLElement | null {
    return document.querySelector<HTMLElement>("[data-waveform-redraw-bg]");
  }

  it("renders a standalone background element behind the WaveSurfer canvases so reRender cannot remove it", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50 });
    await render(<TimelineWaveform />);
    const bg = getBackground();
    expect(bg).not.toBeNull();
    expect(bg?.style.width).toBe("1500px");
    expect(bg?.style.height).toBe("80px");
  });

  it("background uses bg-composer-bg so it matches the page and the area never visually 'pops'", async () => {
    setupWaveformAudio(30);
    await render(<TimelineWaveform />);
    expect(getBackground()?.className).toContain("bg-composer-bg");
  });

  it("background owns the border and shadow so they remain visible while the WaveSurfer fade-in is mid-flight", async () => {
    setupWaveformAudio(30);
    await render(<TimelineWaveform />);
    const bg = getBackground();
    expect(bg?.className).toContain("border-b");
    expect(bg?.className).toContain("border-composer-border");
    expect(bg?.className).toContain("shadow-lg");
  });

  it("the WaveSurfer fade wrapper holds the opacity transition, NOT the outer sticky host", async () => {
    setupWaveformAudio(30);
    useAudioStore.setState({ audioElement: new Audio() });
    await render(<TimelineWaveform />);
    const fade = document.querySelector<HTMLElement>("[data-waveform-fade]");
    expect(fade).not.toBeNull();
    expect(fade?.className).toContain("transition-opacity");
    expect(fade?.style.opacity).toBe("0");
  });

  it("does not render the fade wrapper when there is no audio element", async () => {
    setupWaveformAudio(30);
    useAudioStore.setState({ audioElement: null });
    await render(<TimelineWaveform />);
    expect(document.querySelector<HTMLElement>("[data-waveform-fade]")).toBeNull();
  });

  it("outer sticky host does not own the opacity transition (so the bg + chrome are never faded)", async () => {
    setupWaveformAudio(30);
    const screen = await render(<TimelineWaveform />);
    const host = screen.container.querySelector<HTMLElement>(".sticky");
    expect(host?.className).not.toContain("transition-opacity");
    expect(host?.style.opacity).toBe("");
  });

  it("outer sticky host does not own border or shadow (they belong to the bg element now)", async () => {
    setupWaveformAudio(30);
    const screen = await render(<TimelineWaveform />);
    const host = screen.container.querySelector<HTMLElement>(".sticky");
    expect(host?.className).not.toContain("border-b");
    expect(host?.className).not.toContain("shadow-lg");
  });

  it("background is non-interactive so it never intercepts seek clicks", async () => {
    setupWaveformAudio(30);
    await render(<TimelineWaveform />);
    expect(getBackground()?.className).toContain("pointer-events-none");
  });

  it("background is absolutely positioned at the top-left so it sits under the canvases", async () => {
    setupWaveformAudio(30);
    await render(<TimelineWaveform />);
    const bg = getBackground();
    expect(bg?.className).toContain("absolute");
    expect(bg?.className).toContain("top-0");
    expect(bg?.className).toContain("left-0");
  });

  it("background width tracks zoom changes so it always covers the redraw area", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50 });
    await render(<TimelineWaveform />);
    expect(getBackground()?.style.width).toBe("1500px");

    useTimelineStore.setState({ zoom: 80 });
    await new Promise((r) => requestAnimationFrame(r));
    expect(getBackground()?.style.width).toBe("2400px");
  });

  it("renders the background before the WaveSurfer host in DOM order so canvases paint on top", async () => {
    setupWaveformAudio(30);
    const screen = await render(<TimelineWaveform />);
    const host = screen.container.querySelector<HTMLElement>(".sticky");
    if (!host) throw new Error("waveform host not found");
    const children = Array.from(host.children) as HTMLElement[];
    const bgIdx = children.findIndex((c) => c.hasAttribute("data-waveform-redraw-bg"));
    const clickLayerIdx = children.findIndex((c) => c.classList.contains("cursor-pointer"));
    expect(bgIdx).toBeGreaterThanOrEqual(0);
    expect(bgIdx).toBeLessThan(clickLayerIdx);
  });

  it("background width is 0 when duration is unset so it never extends past the audio range", async () => {
    setupWaveformAudio(0);
    await render(<TimelineWaveform />);
    expect(getBackground()?.style.width).toBe("0px");
  });

  it("does not render the background when there is no audio source (component is null)", async () => {
    useAudioStore.setState({ source: null });
    await render(<TimelineWaveform />);
    expect(getBackground()).toBeNull();
  });
});

describe("TimelineWaveform loading dots", () => {
  function getDots(): HTMLElement | null {
    return document.querySelector<HTMLElement>("[data-waveform-loading-dots]");
  }

  it("renders the dots loading layer above the static bg when an audio source exists", async () => {
    setupWaveformAudio(30);
    await render(<TimelineWaveform />);
    expect(getDots()).not.toBeNull();
  });

  it("does not render the dots layer without an audio source (component is null)", async () => {
    useAudioStore.setState({ source: null });
    await render(<TimelineWaveform />);
    expect(getDots()).toBeNull();
  });

  it("uses the waveform-loading-dots utility so the shimmer sweep pattern paints", async () => {
    setupWaveformAudio(30);
    await render(<TimelineWaveform />);
    expect(getDots()?.className).toContain("waveform-loading-dots");
  });

  it("matches the waveform width and height so it covers the entire redraw area", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50 });
    await render(<TimelineWaveform />);
    expect(getDots()?.style.width).toBe("1500px");
    expect(getDots()?.style.height).toBe("80px");
  });

  it("is non-interactive so it never intercepts seek clicks", async () => {
    setupWaveformAudio(30);
    await render(<TimelineWaveform />);
    expect(getDots()?.className).toContain("pointer-events-none");
  });

  it("is fully visible (opacity 1) while WaveSurfer has not become ready", async () => {
    setupWaveformAudio(30);
    await render(<TimelineWaveform />);
    expect(getDots()?.style.opacity).toBe("1");
  });

  it("holds an opacity transition so it crossfades with the WaveSurfer layer instead of popping", async () => {
    setupWaveformAudio(30);
    await render(<TimelineWaveform />);
    expect(getDots()?.className).toContain("transition-opacity");
  });

  it("is absolutely positioned at top-left so it stacks directly over the static bg", async () => {
    setupWaveformAudio(30);
    await render(<TimelineWaveform />);
    const dots = getDots();
    expect(dots?.className).toContain("absolute");
    expect(dots?.className).toContain("top-0");
    expect(dots?.className).toContain("left-0");
  });

  it("width tracks zoom changes so the loading shimmer never falls short of the redraw area", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50 });
    await render(<TimelineWaveform />);
    expect(getDots()?.style.width).toBe("1500px");

    useTimelineStore.setState({ zoom: 80 });
    await new Promise((r) => requestAnimationFrame(r));
    expect(getDots()?.style.width).toBe("2400px");
  });

  it("sits BETWEEN the static bg and the WaveSurfer fade wrapper in DOM order", async () => {
    setupWaveformAudio(30);
    useAudioStore.setState({ audioElement: new Audio() });
    const screen = await render(<TimelineWaveform />);
    const host = screen.container.querySelector<HTMLElement>(".sticky");
    if (!host) throw new Error("waveform host not found");
    const children = Array.from(host.children) as HTMLElement[];
    const bgIdx = children.findIndex((c) => c.hasAttribute("data-waveform-redraw-bg"));
    const dotsIdx = children.findIndex((c) => c.hasAttribute("data-waveform-loading-dots"));
    const fadeIdx = children.findIndex((c) => c.hasAttribute("data-waveform-fade"));
    expect(bgIdx).toBeGreaterThanOrEqual(0);
    expect(dotsIdx).toBeGreaterThan(bgIdx);
    expect(fadeIdx).toBeGreaterThan(dotsIdx);
  });

  it("width is 0 when duration is unset so it never extends past the audio range", async () => {
    setupWaveformAudio(0);
    await render(<TimelineWaveform />);
    expect(getDots()?.style.width).toBe("0px");
  });

  it("renders even when there is no audioElement yet (covers the brief pre-load gap)", async () => {
    setupWaveformAudio(30);
    useAudioStore.setState({ audioElement: null });
    await render(<TimelineWaveform />);
    expect(getDots()).not.toBeNull();
    expect(getDots()?.style.opacity).toBe("1");
  });

  it("is decorative (aria-hidden) so screen readers don't announce the loading shimmer", async () => {
    setupWaveformAudio(30);
    await render(<TimelineWaveform />);
    expect(getDots()?.getAttribute("aria-hidden")).toBe("true");
  });
});
