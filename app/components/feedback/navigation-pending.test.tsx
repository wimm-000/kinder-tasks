import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Form, Link, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { NavigationPending } from "./navigation-pending";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("NavigationPending", () => {
  it("shows loading feedback and a click blocker during navigation", async () => {
    const gate = deferred();
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <>
              <NavigationPending />
              <Link to="/next">Abrir página</Link>
            </>
          ),
        },
        {
          path: "/next",
          loader: async () => {
            await gate.promise;
            return null;
          },
          element: <h1>Página cargada</h1>,
        },
      ],
      { initialEntries: ["/"] },
    );
    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await user.click(screen.getByRole("link", { name: "Abrir página" }));
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.getByTestId("navigation-blocker")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("aria-busy", "true");

    gate.resolve();
    expect(await screen.findByRole("heading", { name: "Página cargada" })).toBeVisible();
    await waitFor(() => expect(document.documentElement).not.toHaveAttribute("aria-busy"));
  });

  it("identifies form mutations as saving", async () => {
    const gate = deferred();
    const router = createMemoryRouter(
      [
        {
          path: "/",
          action: async () => {
            await gate.promise;
            return null;
          },
          element: (
            <>
              <NavigationPending />
              <Form method="post">
                <button type="submit">Guardar</button>
              </Form>
            </>
          ),
        },
      ],
      { initialEntries: ["/"] },
    );
    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByRole("status")).toHaveTextContent("Guardando cambios…");
    gate.resolve();
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
});
