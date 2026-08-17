export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
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
