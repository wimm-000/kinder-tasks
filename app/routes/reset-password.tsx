import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";

import { AuthPage } from "~/components/auth/auth-page";
import { FormMessage } from "~/components/feedback/form-message";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { authClient } from "~/lib/auth/auth-client";
import { t } from "~/lib/i18n";
import { resetPasswordSchema, type ResetPasswordInput } from "~/schemas/auth";

export function meta() {
  return [{ title: `${t("auth.reset.title")} | ${t("app.name")}` }];
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [requestError, setRequestError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    if (!token) {
      setRequestError(t("auth.reset.invalid"));
      return;
    }
    setRequestError(undefined);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setRequestError(t("auth.reset.invalid"));
      return;
    }
    setSuccess(true);
  });

  return (
    <AuthPage
      eyebrow={t("auth.reset.eyebrow")}
      title={t("auth.reset.title")}
      description={t("auth.reset.description")}
    >
      {success ? (
        <div className="space-y-5">
          <FormMessage message={t("auth.reset.success")} variant="success" />
          <Button className="w-full" size="lg" asChild>
            <Link to="/login">{t("auth.reset.login")}</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-5" noValidate onSubmit={onSubmit}>
          <FormMessage message={requestError ?? (!token ? t("auth.reset.invalid") : undefined)} />
          <TextField
            autoComplete="new-password"
            type="password"
            label={t("auth.reset.password")}
            error={errors.password ? t("auth.validation.password") : undefined}
            {...register("password")}
          />
          <TextField
            autoComplete="new-password"
            type="password"
            label={t("auth.reset.confirmPassword")}
            error={errors.confirmPassword ? t("auth.validation.passwordMismatch") : undefined}
            {...register("confirmPassword")}
          />
          <Button className="w-full" size="lg" disabled={isSubmitting || !token} type="submit">
            <KeyRound className="size-5" />
            {isSubmitting ? t("auth.reset.submitting") : t("auth.reset.submit")}
          </Button>
        </form>
      )}
    </AuthPage>
  );
}
