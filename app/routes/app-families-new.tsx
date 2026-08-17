import { Form, redirect, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-families-new";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { familySchema } from "~/schemas/families";
import { createFamily } from "~/services/families/families.server";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return { name: session.auth.user.name };
}
export async function action({ request }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await requireAdultSession(request);
  const parsed = familySchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const id = await createFamily(session.auth.user.id, parsed.data.name);
  throw redirect(`/app/${id}`);
}
export default function NewFamily() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AppPage
      name={page.name}
      title={t("families.new.title")}
      description={t("families.new.description")}
    >
      <Form className="max-w-xl rounded-[1.75rem] border bg-card/80 p-7 shadow-sm" method="post">
        <TextField
          label={t("families.name")}
          name="name"
          hint={t("families.nameHint")}
          required
          maxLength={80}
        />
        <div className="mt-5">
          <FormMessage message={result?.error} />
        </div>
        <Button className="mt-6" type="submit">
          {t("families.submit")}
        </Button>
      </Form>
    </AppPage>
  );
}
