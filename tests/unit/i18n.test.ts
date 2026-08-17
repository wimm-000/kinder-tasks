import { describe, expect, it } from "vitest";

import { t } from "~/lib/i18n";

describe("Spanish translations", () => {
  it("returns the requested centralized message", () => {
    expect(t("app.name")).toBe("Kinder Tasks");
    expect(t("home.preview.task")).toBe("Bajar el reciclaje");
  });
});
