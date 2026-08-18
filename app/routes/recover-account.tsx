import { Form, Link, useActionData, useSearchParams } from "react-router";

import type { Route } from "./+types/recover-account";
import { FormMessage } from "~/components/feedback/form-message";
import { Button } from "~/components/ui/button";
import { recoverAccount } from "~/services/privacy/privacy.server";

export function meta() {
  return [{ title: "Recuperar cuenta | Kinder Tasks" }];
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const token = form.get("token");
  if (typeof token !== "string" || token.length < 32) return { error: "Enlace inválido." };
  return (await recoverAccount(token))
    ? { success: "Cuenta recuperada. Ya puedes iniciar sesión." }
    : { error: "El enlace ha caducado o ya fue utilizado." };
}

export default function RecoverAccount() {
  const result = useActionData<typeof action>();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-secondary">Kinder Tasks</p>
      <h1 className="mt-3 font-display text-4xl font-semibold">Recuperar cuenta</h1>
      <p className="mt-4 leading-7 text-muted-foreground">
        Cancela la eliminación antes de que termine el periodo de 30 días.
      </p>
      <div className="mt-5">
        <FormMessage
          message={result?.error ?? result?.success}
          variant={result?.error ? "error" : "success"}
        />
      </div>
      {result?.success ? (
        <Button className="mt-6" asChild>
          <Link to="/login">Iniciar sesión</Link>
        </Button>
      ) : (
        <Form className="mt-6" method="post">
          <input type="hidden" name="token" value={token} />
          <Button disabled={!token} type="submit">
            Recuperar mi cuenta
          </Button>
        </Form>
      )}
    </main>
  );
}
