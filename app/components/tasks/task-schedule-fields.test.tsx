import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TaskScheduleFields } from "./task-schedule-fields";

describe("TaskScheduleFields", () => {
  it("explains each task type and only shows its relevant fields", async () => {
    const user = userEvent.setup();
    render(<TaskScheduleFields />);

    expect(screen.getByText(/Se realiza una sola vez/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Límite de realizaciones")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Tipo de tarea"), "open");
    expect(screen.getByText(/doblar ropa o poner una lavadora/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Límite de realizaciones")).toBeInTheDocument();
    expect(screen.getByText(/hasta tres veces cada día/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Tipo de tarea"), "recurring");
    await user.selectOptions(screen.getByLabelText("Recurrencia"), "weekly");
    expect(screen.getByLabelText("Día de la semana")).toBeInTheDocument();
    expect(screen.queryByLabelText("Límite de realizaciones")).not.toBeInTheDocument();
  });
});
