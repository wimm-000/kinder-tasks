import { getServerEnv } from "~/lib/env.server";

import {
  ConsoleEmailService,
  type EmailMessage,
  type EmailService,
  ResendEmailService,
} from "./email-service.server";

let emailService: EmailService | undefined;

export function getEmailService(): EmailService {
  if (emailService) return emailService;

  const env = getServerEnv();
  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      throw new Error("Resend email configuration is incomplete");
    }
    emailService = new ResendEmailService(env.RESEND_API_KEY, env.EMAIL_FROM);
  } else {
    emailService = new ConsoleEmailService(env.NODE_ENV !== "production");
  }
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
