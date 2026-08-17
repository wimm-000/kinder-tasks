import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";

import type { Route } from "./+types/forgot-password";
import { AuthPage } from "~/components/auth/auth-page";
import { FormMessage } from "~/components/feedback/form-message";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { authClient } from "~/lib/auth/auth-client";
import { redirectAuthenticatedAdult } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { emailSchema, type EmailInput } from "~/schemas/auth";

export function meta() {
  return [{ title: `${t("auth.forgot.title")} | ${t("app.name")}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await redirectAuthenticatedAdult(request);
  return null;
}

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailInput>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async ({ email }) => {
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setSent(true);
  });

  return (
    <AuthPage
      eyebrow={t("auth.forgot.eyebrow")}
      title={t("auth.forgot.title")}
      description={t("auth.forgot.description")}
    >
      <form className="space-y-5" noValidate onSubmit={onSubmit}>
        <FormMessage message={sent ? t("auth.forgot.sent") : undefined} variant="success" />
        <TextField
          autoComplete="email"
          inputMode="email"
          type="email"
          label={t("auth.forgot.email")}
          error={errors.email ? t("auth.validation.email") : undefined}
          {...register("email")}
        />
        <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
          <Mail className="size-5" />
          {isSubmitting ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
        </Button>
        <Button className="w-full" variant="ghost" asChild>
          <Link to="/login">
            <ArrowLeft className="size-4" />
            {t("auth.forgot.back")}
          </Link>
        </Button>
      </form>
    </AuthPage>
  );
}
