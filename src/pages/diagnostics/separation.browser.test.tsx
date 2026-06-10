import { describe, expect, it } from "vitest";
import SeparationDiagnosticPage, { DiagnosticsPanel } from "@/pages/diagnostics/separation";
import { render } from "@/test/render";

describe("SeparationDiagnosticPage", () => {
  it("exports a default component function", () => {
    expect(typeof SeparationDiagnosticPage).toBe("function");
  });

  it("renders the dev panel under DEV mode (Vitest dev environment)", async () => {
    const screen = await render(<DiagnosticsPanel />);
    await expect.element(screen.getByText(/Separation Diagnostic/)).toBeInTheDocument();
  });

  it("shows the file chooser when no audio has been loaded", async () => {
    const screen = await render(<DiagnosticsPanel />);
    await expect.element(screen.getByRole("button", { name: /Choose file/ })).toBeInTheDocument();
    await expect.element(screen.getByText(/No file selected/)).toBeInTheDocument();
  });

  it("exposes an accessible file input for audio uploads", async () => {
    const screen = await render(<DiagnosticsPanel />);
    await expect.element(screen.getByLabelText(/Audio file input/)).toBeInTheDocument();
  });

  it("renders the init and run controls in a disabled state until a file is decoded", async () => {
    const screen = await render(<DiagnosticsPanel />);
    const initButton = screen.getByRole("button", { name: /Init model/ });
    const runButton = screen.getByRole("button", { name: /Run separation/ });
    await expect.element(initButton).toBeDisabled();
    await expect.element(runButton).toBeDisabled();
  });
});
