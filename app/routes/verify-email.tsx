import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";

import { AuthPage } from "~/components/auth/auth-page";
import { FormMessage } from "~/components/feedback/form-message";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { authClient } from "~/lib/auth/auth-client";
import { t } from "~/lib/i18n";
import { emailSchema, type EmailInput } from "~/schemas/auth";

export function meta() {
  return [{ title: `${t("auth.verify.title")} | ${t("app.name")}` }];
}

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const isVerified = searchParams.get("verified") === "1";
  const isInvalid = Boolean(searchParams.get("error"));
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: searchParams.get("email") ?? "" },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    await authClient.sendVerificationEmail({ email, callbackURL: "/verify-email?verified=1" });
    setSent(true);
  });

  const title = isVerified
    ? t("auth.verify.verifiedTitle")
    : isInvalid
      ? t("auth.verify.invalidTitle")
      : t("auth.verify.title");
  const description = isVerified
    ? t("auth.verify.verifiedDescription")
    : isInvalid
      ? t("auth.verify.invalidDescription")
      : t("auth.verify.description");

  return (
    <AuthPage eyebrow={t("auth.verify.eyebrow")} title={title} description={description}>
      {isVerified ? (
        <Button className="w-full" size="lg" asChild>
          <Link to="/app">
            {t("auth.verify.continue")}
            <ArrowRight className="size-5" />
          </Link>
        </Button>
      ) : (
        <form className="space-y-5" noValidate onSubmit={onSubmit}>
          <FormMessage message={sent ? t("auth.verify.sent") : undefined} variant="success" />
          <TextField
            autoComplete="email"
            inputMode="email"
            type="email"
            label={t("auth.verify.email")}
            error={errors.email ? t("auth.validation.email") : undefined}
            {...register("email")}
          />
          <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
            <MailCheck className="size-5" />
            {isSubmitting ? t("auth.verify.sending") : t("auth.verify.resend")}
          </Button>
          <Button className="w-full" variant="ghost" asChild>
            <Link to="/login">
              <ArrowLeft className="size-4" />
              {t("auth.verify.backLogin")}
            </Link>
          </Button>
        </form>
      )}
    </AuthPage>
  );
}
