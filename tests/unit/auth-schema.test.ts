import { describe, expect, it } from "vitest";

import { registerSchema, safeRedirect } from "~/schemas/auth";

describe("authentication input", () => {
  it("requires matching strong passwords and accepted terms", () => {
    const result = registerSchema.safeParse({
      name: "Paula",
      email: "paula@example.test",
      password: "UnaContraseñaSegura2026!",
      confirmPassword: "OtraContraseñaSegura2026!",
      acceptTerms: false,
    });

    expect(result.success).toBe(false);
  });

  it("only redirects to local application paths", () => {
    expect(safeRedirect("/app/security")).toBe("/app/security");
    expect(safeRedirect("//malicious.example")).toBe("/app");
    expect(safeRedirect("https://malicious.example")).toBe("/app");
  });
});
