import { describe, expect, it } from "vitest";

import { childLockDuration } from "~/lib/auth/child-pin.server";
import { createChildSchema } from "~/schemas/children";

describe("child profile validation", () => {
  it("preserves a leading-zero PIN and trims the alias", () => {
    const result = createChildSchema.parse({
      alias: "  Leo  ",
      avatarKey: "fox",
      profileColor: "teal",
      pin: "0123",
      confirmPin: "0123",
    });
    expect(result).toMatchObject({ alias: "Leo", pin: "0123" });
  });

  it("rejects unknown options and mismatched PIN values", () => {
    expect(
      createChildSchema.safeParse({
        alias: "Leo",
        avatarKey: "unknown",
        profileColor: "teal",
        pin: "1234",
        confirmPin: "9999",
      }).success,
    ).toBe(false);
  });
});

describe("child lock progression", () => {
  it("progresses from five minutes to one hour", () => {
    expect(childLockDuration(4)).toBe(0);
    expect(childLockDuration(5)).toBe(5 * 60_000);
    expect(childLockDuration(6)).toBe(15 * 60_000);
    expect(childLockDuration(7)).toBe(60 * 60_000);
  });
});
