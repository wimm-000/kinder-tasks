import { describe, expect, it } from "vitest";
import { allowancePeriodKey, firstDueDate, nextDueDate } from "~/domain/allowances/calendar";

describe("allowance calendar", () => {
  it("uses ISO weekdays", () => {
    expect(firstDueDate({ frequency: "weekly", weekday: 1 }, "2026-08-18").toString()).toBe(
      "2026-08-24",
    );
  });
  it("clamps day 31 without drifting after February", () => {
    const february = nextDueDate({ frequency: "monthly", monthDay: 31 }, "2026-01-31");
    expect(february.toString()).toBe("2026-02-28");
    expect(
      nextDueDate({ frequency: "monthly", monthDay: 31 }, february.toString()).toString(),
    ).toBe("2026-03-31");
  });
  it("supports leap years and stable keys", () => {
    const date = nextDueDate({ frequency: "monthly", monthDay: 31 }, "2024-01-31");
    expect(date.toString()).toBe("2024-02-29");
    expect(allowancePeriodKey("monthly", date)).toBe("2024-02");
  });
});
