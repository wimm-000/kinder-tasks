import { describe, expect, it } from "vitest";
import { getTaskPeriod } from "~/domain/tasks/availability";

describe("task availability periods", () => {
  it("uses one stable period for one-off tasks", () => {
    expect(getTaskPeriod({ type: "one_off" })?.key).toBe("once");
  });
  it("derives daily and monthly periods", () => {
    const now = new Date("2026-08-17T10:00:00Z");
    expect(
      getTaskPeriod({ type: "recurring", recurrenceUnit: "daily", recurrenceInterval: 1 }, now)
        ?.key,
    ).toBe("day:2026-08-17");
    expect(getTaskPeriod({ type: "open", openLimitPeriod: "month" }, now)?.key).toBe(
      "month:2026-08",
    );
  });
  it("clamps monthly recurrence to the last valid day", () => {
    expect(
      getTaskPeriod(
        { type: "recurring", recurrenceUnit: "monthly", recurrenceMonthDay: 31 },
        new Date("2026-02-28T10:00:00Z"),
      )?.key,
    ).toBe("month:2026-02");
  });
  it("rejects a weekly task outside its weekday", () => {
    expect(
      getTaskPeriod(
        { type: "recurring", recurrenceUnit: "weekly", recurrenceWeekday: 2 },
        new Date("2026-08-17T10:00:00Z"),
      ),
    ).toBeNull();
  });
});
