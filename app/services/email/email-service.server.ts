export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

type EmailFetch = typeof fetch;

export class ResendEmailService implements EmailService {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetcher: EmailFetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await this.fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const requestId = response.headers.get("x-resend-id") ?? response.headers.get("cf-ray");
      throw new Error(
        `Resend email delivery failed with status ${response.status}${requestId ? ` (${requestId})` : ""}`,
      );
    }
  }
}

export class ConsoleEmailService implements EmailService {
  constructor(private readonly allowSensitiveOutput: boolean) {}

  async send(message: EmailMessage): Promise<void> {
    if (!this.allowSensitiveOutput) {
      throw new Error("A production email provider must be configured before sending email");
    }

    console.info(
      JSON.stringify({
        type: "development_email",
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    );
  }
}

export class MemoryEmailService implements EmailService {
  readonly messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }
}
