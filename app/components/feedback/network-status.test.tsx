import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { t } from "~/lib/i18n";

import { NetworkStatus } from "./network-status";

describe("NetworkStatus", () => {
  it("announces when the browser loses connection", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    render(<NetworkStatus />);

    expect(screen.getByText(t("network.online"))).toBeInTheDocument();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    act(() => window.dispatchEvent(new Event("offline")));

    expect(screen.getByText(t("network.offline"))).toBeInTheDocument();
  });
});
