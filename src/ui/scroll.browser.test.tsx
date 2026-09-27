import { beforeEach, describe, expect, it } from "vitest";
import { installStyleSheet } from "@/test/browser-css";
import { Scroll } from "@/ui/scroll";
import { render } from "@/test/render";
import { useRef } from "react";

function ViewportRefHarness({ onMount }: { onMount: (el: HTMLDivElement | null) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const proxyRef = {
    get current() {
      return ref.current;
    },
    set current(value) {
      ref.current = value;
      onMount(value);
    },
  } as { current: HTMLDivElement | null };
  return (
    <Scroll viewportRef={proxyRef}>
      <div style={{ height: 1000 }}>scroll content</div>
    </Scroll>
  );
}

describe("Scroll", () => {
  it("renders children inside the OverlayScrollbars wrapper", async () => {
    const screen = await render(
      <Scroll>
        <div>scroll content</div>
      </Scroll>,
    );
    await expect.element(screen.getByText("scroll content")).toBeInTheDocument();
  });

  it("applies an extra className from props", async () => {
    const screen = await render(
      <Scroll className="extra-test-class">
        <div>body</div>
      </Scroll>,
    );
    const wrapper = screen.container.querySelector(".extra-test-class");
    expect(wrapper).not.toBeNull();
  });

  it("sets the viewportRef once OverlayScrollbars initializes", async () => {
    let observed: HTMLDivElement | null = null;
    await render(
      <ViewportRefHarness
        onMount={(el) => {
          observed = el;
        }}
      />,
    );
    await expect.poll(() => observed).not.toBeNull();
  });

  it("hands the viewport to onInitialized once OverlayScrollbars initializes", async () => {
    let viewport: HTMLDivElement | null = null;
    await render(
      <Scroll
        onInitialized={(element) => {
          viewport = element;
        }}
      >
        <p>Scrolled content</p>
      </Scroll>,
    );
    await expect.poll(() => viewport?.textContent).toContain("Scrolled content");
  });
});

describe("Scroll initialScrollTop", () => {
  beforeEach(() => {
    installStyleSheet(".initial-scroll-host{height:200px;overflow:auto}");
  });

  const activeScroller = (content: Element | null) =>
    content?.closest<HTMLElement>("[data-overlayscrollbars-viewport]") ??
    content?.closest<HTMLElement>(".initial-scroll-host") ??
    null;

  it("is already at the initial position on the first paint, before OverlayScrollbars initializes", async () => {
    const screen = await render(
      <Scroll className="initial-scroll-host" initialScrollTop={150}>
        <div style={{ height: 1000 }}>tall content</div>
      </Scroll>,
    );
    const content = screen.getByText("tall content").element();
    expect(activeScroller(content)?.scrollTop).toBe(150);
  });

  it("keeps the position once OverlayScrollbars takes over", async () => {
    let viewport: HTMLDivElement | null = null;
    await render(
      <Scroll
        className="initial-scroll-host"
        initialScrollTop={150}
        onInitialized={(element) => {
          viewport = element;
        }}
      >
        <div style={{ height: 1000 }}>tall content</div>
      </Scroll>,
    );
    await expect.poll(() => viewport?.scrollTop).toBe(150);
  });

  describe("edge cases", () => {
    it("clamps to the maximum when the content is shorter than the saved position", async () => {
      const screen = await render(
        <Scroll className="initial-scroll-host" initialScrollTop={5000}>
          <div style={{ height: 300 }}>short content</div>
        </Scroll>,
      );
      expect(activeScroller(screen.getByText("short content").element())?.scrollTop).toBe(100);
    });
  });
});
