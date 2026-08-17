import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLoaderData, useNavigate } from "react-router";

import type { Route } from "./+types/login";
import { AuthPage } from "~/components/auth/auth-page";
import { FormMessage } from "~/components/feedback/form-message";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { getAuthErrorMessage } from "~/features/auth/auth-errors";
import { authClient } from "~/lib/auth/auth-client";
import { redirectAuthenticatedAdult } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { loginSchema, safeRedirect, type LoginInput } from "~/schemas/auth";

export function meta() {
  return [{ title: `${t("auth.login.title")} | ${t("app.name")}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await redirectAuthenticatedAdult(request);
  const url = new URL(request.url);
  return { redirectTo: safeRedirect(url.searchParams.get("redirectTo")) };
}

export default function Login() {
  const { redirectTo } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [requestError, setRequestError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setRequestError(undefined);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      rememberMe: values.rememberMe,
    });

    if (error) {
      setRequestError(getAuthErrorMessage(error));
      return;
    }

    navigate(redirectTo, { replace: true });
  });

  return (
    <AuthPage
      eyebrow={t("auth.login.eyebrow")}
      title={t("auth.login.title")}
      description={t("auth.login.description")}
      footer={
        <p>
          {t("auth.login.noAccount")}{" "}
          <Link className="font-bold text-foreground underline underline-offset-4" to="/register">
            {t("auth.login.register")}
          </Link>
        </p>
      }
    >
      <form className="space-y-5" noValidate onSubmit={onSubmit}>
        <FormMessage message={requestError} />
        <TextField
          autoComplete="email"
          inputMode="email"
          type="email"
          label={t("auth.login.email")}
          error={errors.email ? t("auth.validation.email") : undefined}
          {...register("email")}
        />
        <TextField
          autoComplete="current-password"
          type="password"
          label={t("auth.login.password")}
          error={errors.password ? t("auth.error.invalidCredentials") : undefined}
          {...register("password")}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
            <input
              className="size-5 rounded border-border accent-primary"
              type="checkbox"
              {...register("rememberMe")}
            />
            {t("auth.login.remember")}
          </label>
          <Link className="font-bold underline underline-offset-4" to="/forgot-password">
            {t("auth.login.forgot")}
          </Link>
        </div>
        <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
          {isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
          {!isSubmitting ? <ArrowRight className="size-5" /> : null}
        </Button>
      </form>
    </AuthPage>
  );
}
