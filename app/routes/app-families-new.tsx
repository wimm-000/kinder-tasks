import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { v7 as uuidv7 } from "uuid";

import type { Route } from "./+types/app-families-new";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { TextField } from "~/components/ui/text-field";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { createFamilySchema } from "~/schemas/families";
import { createFamily } from "~/services/families/families.server";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return { name: session.auth.user.name, clientRequestId: uuidv7() };
}
export async function action({ request }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await requireAdultSession(request);
  const parsed = createFamilySchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const id = await createFamily(
    session.auth.user.id,
    parsed.data.name,
    parsed.data.clientRequestId,
  );
  throw redirect(`/app/${id}`);
}
export default function NewFamily() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  return (
    <AppPage
      name={page.name}
      title={t("families.new.title")}
      description={t("families.new.description")}
    >
      <Form className="max-w-xl rounded-[1.75rem] border bg-card/80 p-7 shadow-sm" method="post">
        <input type="hidden" name="clientRequestId" value={page.clientRequestId} />
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
        <Button className="mt-6" disabled={submitting} type="submit">
          {submitting ? "Creando…" : t("families.submit")}
        </Button>
      </Form>
    </AppPage>
  );
}
