import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import type { Route } from "./+types/register";
import { AuthPage } from "~/components/auth/auth-page";
import { FormMessage } from "~/components/feedback/form-message";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { getAuthErrorMessage } from "~/features/auth/auth-errors";
import { authClient } from "~/lib/auth/auth-client";
import { redirectAuthenticatedAdult } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { registerSchema, type RegisterInput } from "~/schemas/auth";

export function meta() {
  return [{ title: `${t("auth.register.title")} | ${t("app.name")}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await redirectAuthenticatedAdult(request);
  return null;
}

export default function Register() {
  const navigate = useNavigate();
  const [requestError, setRequestError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", acceptTerms: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setRequestError(undefined);
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      callbackURL: "/verify-email?verified=1",
    });

    if (error) {
      setRequestError(getAuthErrorMessage(error));
      return;
    }

    navigate(`/verify-email?email=${encodeURIComponent(values.email)}`);
  });

  return (
    <AuthPage
      eyebrow={t("auth.register.eyebrow")}
      title={t("auth.register.title")}
      description={t("auth.register.description")}
      footer={
        <p>
          {t("auth.register.hasAccount")}{" "}
          <Link className="font-bold text-foreground underline underline-offset-4" to="/login">
            {t("auth.register.login")}
          </Link>
        </p>
      }
    >
      <form className="space-y-5" noValidate onSubmit={onSubmit}>
        <FormMessage message={requestError} />
        <TextField
          autoComplete="name"
          label={t("auth.register.name")}
          error={errors.name ? t("auth.validation.name") : undefined}
          {...register("name")}
        />
        <TextField
          autoComplete="email"
          inputMode="email"
          type="email"
          label={t("auth.register.email")}
          error={errors.email ? t("auth.validation.email") : undefined}
          {...register("email")}
        />
        <TextField
          autoComplete="new-password"
          type="password"
          label={t("auth.register.password")}
          hint={t("auth.register.passwordHint")}
          error={errors.password ? t("auth.validation.password") : undefined}
          {...register("password")}
        />
        <TextField
          autoComplete="new-password"
          type="password"
          label={t("auth.register.confirmPassword")}
          error={errors.confirmPassword ? t("auth.validation.passwordMismatch") : undefined}
          {...register("confirmPassword")}
        />
        <div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6">
            <input
              className="mt-1 size-5 rounded border-border accent-primary"
              type="checkbox"
              {...register("acceptTerms")}
            />
            <span>
              {t("auth.register.acceptPrefix")}{" "}
              <Link className="font-bold underline underline-offset-4" to="/terms">
                {t("auth.register.terms")}
              </Link>{" "}
              {t("auth.register.and")}{" "}
              <Link className="font-bold underline underline-offset-4" to="/privacy">
                {t("auth.register.privacy")}
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms ? (
            <p className="mt-2 text-sm font-semibold text-secondary">
              {t("auth.validation.terms")}
            </p>
          ) : null}
        </div>
        <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
          {isSubmitting ? t("auth.register.submitting") : t("auth.register.submit")}
          {!isSubmitting ? <ArrowRight className="size-5" /> : null}
        </Button>
      </form>
    </AuthPage>
  );
}
