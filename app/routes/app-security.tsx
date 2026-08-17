import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Laptop, ShieldX, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLoaderData, useNavigate } from "react-router";

import type { Route } from "./+types/app-security";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { getAuthErrorMessage } from "~/features/auth/auth-errors";
import { authClient } from "~/lib/auth/auth-client";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import {
  changePasswordSchema,
  deleteAccountSchema,
  type ChangePasswordInput,
  type DeleteAccountInput,
} from "~/schemas/auth";

type ListedSession = NonNullable<
  Awaited<ReturnType<typeof authClient.listSessions>>["data"]
>[number];

export function meta() {
  return [{ title: `${t("security.title")} | ${t("app.name")}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const context = await requireAdultSession(request);
  return { name: context.auth.user.name, currentSessionId: context.auth.session.id };
}

export default function Security() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppPage name={data.name} title={t("security.title")} description={t("security.description")}>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChangePasswordCard />
        <SessionsCard currentSessionId={data.currentSessionId} />
        <DeleteAccountCard />
      </div>
    </AppPage>
  );
}

function ChangePasswordCard() {
  const [success, setSuccess] = useState(false);
  const [requestError, setRequestError] = useState<string>();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSuccess(false);
    setRequestError(undefined);
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      setRequestError(getAuthErrorMessage(error));
      return;
    }
    reset();
    setSuccess(true);
  });

  return (
    <section className="rounded-[1.75rem] border bg-card/80 p-6 shadow-sm sm:p-8">
      <KeyRound className="size-7 text-primary" />
      <h2 className="mt-6 font-display text-2xl font-semibold">{t("security.password.title")}</h2>
      <form className="mt-6 space-y-5" noValidate onSubmit={onSubmit}>
        <FormMessage message={requestError} />
        <FormMessage
          message={success ? t("security.password.success") : undefined}
          variant="success"
        />
        <TextField
          autoComplete="current-password"
          type="password"
          label={t("security.password.current")}
          error={errors.currentPassword ? t("auth.error.invalidCredentials") : undefined}
          {...register("currentPassword")}
        />
        <TextField
          autoComplete="new-password"
          type="password"
          label={t("security.password.new")}
          error={errors.newPassword ? t("auth.validation.password") : undefined}
          {...register("newPassword")}
        />
        <TextField
          autoComplete="new-password"
          type="password"
          label={t("security.password.confirm")}
          error={errors.confirmPassword ? t("auth.validation.passwordMismatch") : undefined}
          {...register("confirmPassword")}
        />
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? t("security.password.submitting") : t("security.password.submit")}
        </Button>
      </form>
    </section>
  );
}

function SessionsCard({ currentSessionId }: { currentSessionId: string }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ListedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    void authClient.listSessions().then(({ data }) => {
      setSessions(data ?? []);
      setLoading(false);
    });
  }, []);

  const revoke = async (session: ListedSession) => {
    await authClient.revokeSession({ token: session.token });
    if (session.id === currentSessionId) {
      navigate("/login", { replace: true });
      return;
    }
    setSessions((current) => current.filter(({ id }) => id !== session.id));
  };

  const revokeOthers = async () => {
    await authClient.revokeOtherSessions();
    setSessions((current) => current.filter(({ id }) => id === currentSessionId));
    setMessage(t("security.sessions.revoked"));
  };

  return (
    <section className="rounded-[1.75rem] border bg-card/80 p-6 shadow-sm sm:p-8">
      <Laptop className="size-7 text-secondary" />
      <h2 className="mt-6 font-display text-2xl font-semibold">{t("security.sessions.title")}</h2>
      <FormMessage message={message} variant="success" />
      {loading ? (
        <p className="mt-6 text-muted-foreground">{t("security.sessions.loading")}</p>
      ) : null}
      <ul className="mt-6 space-y-3">
        {sessions.map((session) => (
          <li className="rounded-2xl bg-muted/70 p-4" key={session.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {session.id === currentSessionId
                    ? t("security.sessions.current")
                    : (session.userAgent ?? t("security.sessions.unknown"))}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("security.sessions.expires")}:{" "}
                  {new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
                    new Date(session.expiresAt),
                  )}
                </p>
              </div>
              <Button
                aria-label={t("security.sessions.revoke")}
                size="sm"
                variant="ghost"
                onClick={() => revoke(session)}
              >
                <ShieldX className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {sessions.length > 1 ? (
        <Button className="mt-5" variant="outline" onClick={revokeOthers}>
          {t("security.sessions.revokeOthers")}
        </Button>
      ) : null}
    </section>
  );
}

function DeleteAccountCard() {
  const navigate = useNavigate();
  const [requestError, setRequestError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "", confirmation: "" as "ELIMINAR" },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setRequestError(undefined);
    const { error } = await authClient.deleteUser({ password });
    if (error) {
      setRequestError(getAuthErrorMessage(error));
      return;
    }
    navigate("/", { replace: true });
  });

  return (
    <section className="rounded-[1.75rem] border border-secondary/40 bg-secondary/5 p-6 shadow-sm sm:p-8 lg:col-span-2">
      <Trash2 className="size-7 text-secondary" />
      <h2 className="mt-6 font-display text-2xl font-semibold">{t("security.delete.title")}</h2>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        {t("security.delete.description")}
      </p>
      <form className="mt-6 grid max-w-2xl gap-5 sm:grid-cols-2" noValidate onSubmit={onSubmit}>
        <div className="sm:col-span-2">
          <FormMessage message={requestError} />
        </div>
        <TextField
          autoComplete="current-password"
          type="password"
          label={t("security.delete.password")}
          error={errors.password ? t("auth.error.invalidCredentials") : undefined}
          {...register("password")}
        />
        <TextField
          autoComplete="off"
          label={t("security.delete.confirmation")}
          error={errors.confirmation ? t("security.delete.confirmationError") : undefined}
          {...register("confirmation")}
        />
        <div className="sm:col-span-2">
          <Button
            className="bg-secondary text-secondary-foreground hover:bg-secondary/85"
            disabled={isSubmitting}
            type="submit"
          >
            <Trash2 className="size-4" />
            {isSubmitting ? t("security.delete.submitting") : t("security.delete.submit")}
          </Button>
        </div>
      </form>
    </section>
  );
}
