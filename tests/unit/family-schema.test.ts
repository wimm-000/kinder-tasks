import { describe, expect, it } from "vitest";

import { familySchema, invitationSchema } from "~/schemas/families";

describe("family input schemas", () => {
  it("trims family names", () => {
    expect(familySchema.parse({ name: "  Familia Robles  " }).name).toBe("Familia Robles");
  });

  it("normalizes invitation emails", () => {
    expect(invitationSchema.parse({ email: "  SARA@EXAMPLE.TEST " }).email).toBe(
      "sara@example.test",
    );
  });
});
