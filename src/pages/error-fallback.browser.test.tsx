import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ErrorFallback } from "@/pages/error-fallback";
import { render } from "@/test/render";
import { allowConsole } from "@/test/console-guard";

const ThrowingRoute: React.FC = () => {
  throw new Error("Boom for test");
};

describe("ErrorFallback", () => {
  beforeEach(() => {
    allowConsole(/Boom for test|route error|RenderErrorBoundary|caught the following error/);
  });

  it("renders Reload and Go home buttons when a route throws", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <ThrowingRoute />,
          errorElement: <ErrorFallback />,
        },
      ],
      { initialEntries: ["/"] },
    );
    const screen = await render(<RouterProvider router={router} />);
    await expect.element(screen.getByRole("button", { name: /Reload/ })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Go home/ })).toBeInTheDocument();
  });
});
