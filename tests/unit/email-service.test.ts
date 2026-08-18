// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { EmailDeliveryError, ResendEmailService } from "~/services/email/email-service.server";

describe("ResendEmailService", () => {
  it("sends a text email with authenticated Resend API data", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ id: "email-id" }, { status: 200 }));
    const service = new ResendEmailService(
      "re_test_key",
      "Kinder Tasks <onboarding@resend.dev>",
      fetcher,
    );

    await service.send({
      to: "andreseldanes@gmail.com",
      subject: "Verifica tu correo",
      text: "Verification link",
    });

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(options?.headers).toMatchObject({
      authorization: "Bearer re_test_key",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      from: "Kinder Tasks <onboarding@resend.dev>",
      to: ["andreseldanes@gmail.com"],
      subject: "Verifica tu correo",
      text: "Verification link",
    });
  });

  it("reports a provider failure without exposing the response body", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: "sensitive provider details" }), {
        status: 422,
        headers: { "x-resend-id": "request-id" },
      }),
    );
    const service = new ResendEmailService("re_test_key", "onboarding@resend.dev", fetcher);

    const error = await service
      .send({ to: "user@example.test", subject: "Subject", text: "Body" })
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(error).toMatchObject({
      message: "Resend email delivery failed with status 422 (request-id)",
      status: 422,
    });
  });
});
