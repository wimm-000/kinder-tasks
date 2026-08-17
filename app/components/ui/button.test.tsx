import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("supports keyboard and pointer activation", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Continuar</Button>);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
