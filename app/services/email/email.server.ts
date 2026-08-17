import { getServerEnv } from "~/lib/env.server";

import { ConsoleEmailService, type EmailMessage, type EmailService } from "./email-service.server";

let emailService: EmailService | undefined;

export function getEmailService(): EmailService {
  if (emailService) return emailService;

  const env = getServerEnv();
  emailService = new ConsoleEmailService(env.NODE_ENV !== "production");
  return emailService;
}

export function setEmailServiceForTests(service: EmailService | undefined): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("The email service can only be replaced in tests");
  }
  emailService = service;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  await getEmailService().send(message);
}
