import { IconKeyboard, IconRocket } from "@tabler/icons-react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ModalNavLayout, type ModalNavSection } from "@/ui/modal-nav-layout";
import { render } from "@/test/render";

// -- Fixtures -----------------------------------------------------------------

const SECTIONS: ModalNavSection[] = [
  { id: "first", label: "First Section", icon: IconRocket },
  { id: "second", label: "Second Section", icon: IconKeyboard },
];

const Harness: React.FC = () => {
  const [activeSection, setActiveSection] = useState("first");
  return (
    <ModalNavLayout sections={SECTIONS} activeSection={activeSection} onSectionChange={setActiveSection}>
      <p>Content for {activeSection}</p>
    </ModalNavLayout>
  );
};

// -- Tests --------------------------------------------------------------------

describe("ModalNavLayout", () => {
  it("renders a nav button for every section", async () => {
    const screen = await render(
      <ModalNavLayout sections={SECTIONS} activeSection="first" onSectionChange={() => {}}>
        <p>Body</p>
      </ModalNavLayout>,
    );
    await expect.element(screen.getByRole("button", { name: /first section/i })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /second section/i })).toBeInTheDocument();
  });

  it("renders the supplied content for the active section", async () => {
    const screen = await render(
      <ModalNavLayout sections={SECTIONS} activeSection="first" onSectionChange={() => {}}>
        <p>Body Content</p>
      </ModalNavLayout>,
    );
    await expect.element(screen.getByText("Body Content")).toBeInTheDocument();
  });

  it("calls onSectionChange with the section id when a nav button is clicked", async () => {
    const changes: string[] = [];
    const screen = await render(
      <ModalNavLayout sections={SECTIONS} activeSection="first" onSectionChange={(id) => changes.push(id)}>
        <p>Body</p>
      </ModalNavLayout>,
    );
    await screen.getByRole("button", { name: /second section/i }).click();
    expect(changes).toEqual(["second"]);
  });

  it("switches the rendered content when a different section is selected", async () => {
    const screen = await render(<Harness />);
    await expect.element(screen.getByText("Content for first")).toBeInTheDocument();
    await screen.getByRole("button", { name: /second section/i }).click();
    await expect.element(screen.getByText("Content for second")).toBeInTheDocument();
  });

  it("renders the sidebar header above the section buttons", async () => {
    const screen = await render(
      <ModalNavLayout
        sections={SECTIONS}
        activeSection="first"
        onSectionChange={() => {}}
        sidebarHeader={<input aria-label="Filter" />}
      >
        <p>Body</p>
      </ModalNavLayout>,
    );
    await expect.element(screen.getByRole("textbox", { name: "Filter" })).toBeInTheDocument();
  });

  it("shows trailing content and marks dimmed sections", async () => {
    const screen = await render(
      <ModalNavLayout
        sections={[
          { ...SECTIONS[0], trailing: <span>4</span> },
          { ...SECTIONS[1], dimmed: true },
        ]}
        activeSection={null}
        onSectionChange={() => {}}
      >
        <p>Body</p>
      </ModalNavLayout>,
    );
    await expect.element(screen.getByRole("button", { name: /First Section/ })).toHaveTextContent("4");
    await expect.element(screen.getByRole("button", { name: /Second Section/ })).toHaveAttribute("data-dimmed");
  });

  it("marks no section active when activeSection is null", async () => {
    const screen = await render(
      <ModalNavLayout sections={SECTIONS} activeSection={null} onSectionChange={() => {}}>
        <p>Body</p>
      </ModalNavLayout>,
    );
    await expect.element(screen.getByRole("button", { name: /First Section/ })).not.toHaveAttribute("aria-current");
  });

  it("hands the content viewport to onContentInitialized and the ref", async () => {
    const viewportRef: { current: HTMLDivElement | null } = { current: null };
    let initialized: HTMLDivElement | null = null;
    await render(
      <ModalNavLayout
        sections={SECTIONS}
        activeSection="first"
        onSectionChange={() => {}}
        contentViewportRef={viewportRef}
        onContentInitialized={(viewport) => {
          initialized = viewport;
        }}
      >
        <p>Scrollable body</p>
      </ModalNavLayout>,
    );
    await expect.poll(() => initialized?.textContent).toContain("Scrollable body");
    expect(viewportRef.current).toBe(initialized);
  });

  it("marks the active section with aria-current", async () => {
    const screen = await render(<Harness />);
    await expect.element(screen.getByRole("button", { name: /First Section/ })).toHaveAttribute("aria-current", "page");
    await screen.getByRole("button", { name: /Second Section/ }).click();
    await expect
      .element(screen.getByRole("button", { name: /Second Section/ }))
      .toHaveAttribute("aria-current", "page");
  });
});
