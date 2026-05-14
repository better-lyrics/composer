import { beforeAll, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ErrorFallback } from "@/pages/error-fallback";
import { render } from "@/test/render";
import { addGlobalAllowedConsolePattern } from "@/test/console-guard";

const ThrowingRoute: React.FC = () => {
  throw new Error("Boom for test");
};

beforeAll(() => {
  addGlobalAllowedConsolePattern(/route error|Boom for test|RenderErrorBoundary|React Router|%o|%s|Future Flag/);
});

describe("ErrorFallback", () => {
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
