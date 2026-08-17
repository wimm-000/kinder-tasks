import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToCents } from "~/domain/money/money";

describe("money values", () => {
  it.each([
    ["12", 1200],
    ["12,3", 1230],
    ["12.34", 1234],
    ["0,01", 1],
  ])("parses %s", (value, cents) => expect(parseMoneyToCents(value)).toBe(cents));
  it.each(["0", "-1", "1.234", "1e3", "texto"])("rejects %s", (value) =>
    expect(() => parseMoneyToCents(value)).toThrow(),
  );
  it("formats signed EUR values", () => {
    expect(formatMoney(2450, true)).toContain("+24,50");
    expect(formatMoney(-800, true)).toContain("-8,00");
  });
});
