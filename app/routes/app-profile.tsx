import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLoaderData } from "react-router";

import type { Route } from "./+types/app-profile";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { getAuthErrorMessage } from "~/features/auth/auth-errors";
import { authClient } from "~/lib/auth/auth-client";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { profileSchema, type ProfileInput } from "~/schemas/auth";

export function meta() {
  return [{ title: `${t("profile.title")} | ${t("app.name")}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requireAdultSession(request);
  return { name: context.auth.user.name, email: context.auth.user.email };
}

export default function Profile() {
  const data = useLoaderData<typeof loader>();
  const [success, setSuccess] = useState(false);
  const [requestError, setRequestError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: data.name },
  });

  const onSubmit = handleSubmit(async ({ name }) => {
    setSuccess(false);
    setRequestError(undefined);
    const { error } = await authClient.updateUser({ name });
    if (error) {
      setRequestError(getAuthErrorMessage(error));
      return;
    }
    setSuccess(true);
  });

  return (
    <AppPage name={data.name} title={t("profile.title")} description={t("profile.description")}>
      <form
        className="max-w-xl space-y-5 rounded-[1.75rem] border bg-card/80 p-6 shadow-sm sm:p-8"
        noValidate
        onSubmit={onSubmit}
      >
        <FormMessage message={requestError} />
        <FormMessage message={success ? t("profile.success") : undefined} variant="success" />
        <TextField
          label={t("profile.name")}
          error={errors.name ? t("auth.validation.name") : undefined}
          {...register("name")}
        />
        <TextField disabled label={t("profile.email")} type="email" value={data.email} readOnly />
        <Button disabled={isSubmitting} type="submit">
          <Save className="size-4" />
          {isSubmitting ? t("profile.submitting") : t("profile.submit")}
        </Button>
      </form>
    </AppPage>
  );
}
