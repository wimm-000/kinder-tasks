import { Form, Link, useActionData, useLoaderData } from "react-router";

import type { Route } from "./+types/app-family-requests";
import { FormMessage } from "~/components/feedback/form-message";
import { AppPage } from "~/components/layout/app-page";
import { Button } from "~/components/ui/button";
import { formatMoney } from "~/domain/money/money";
import { requireAdultSession } from "~/lib/auth/session.server";
import { t } from "~/lib/i18n";
import { requireSameOrigin } from "~/lib/security/origin.server";
import { reviewRequestSchema } from "~/schemas/tasks";
import { listPendingRequests, reviewTaskRequest } from "~/services/tasks/tasks.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAdultSession(request);
  return {
    name: session.auth.user.name,
    ...(await listPendingRequests(session.auth.user.id, params.familyId)),
  };
}
export async function action({ request, params }: Route.ActionArgs) {
  requireSameOrigin(request);
  const session = await requireAdultSession(request);
  const parsed = reviewRequestSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await reviewTaskRequest({
    userId: session.auth.user.id,
    familyId: params.familyId,
    ...parsed.data,
  });
  return { success: "Solicitud revisada." };
}
export default function Requests() {
  const page = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AppPage
      name={page.name}
      title={t("tasks.requests.title")}
      description={t("tasks.requests.description")}
    >
      <Button variant="ghost" asChild>
        <Link to={`/app/${page.context.familyId}`}>{t("tasks.backToFamily")}</Link>
      </Button>
      <div className="mt-6">
        <FormMessage
          message={result?.error ?? result?.success}
          variant={result?.error ? "error" : "success"}
        />
      </div>
      <div className="mt-6 space-y-3">
        {page.requests.map((request) => (
          <article className="rounded-3xl border bg-card/80 p-6" key={request.id}>
            <h2 className="font-display text-2xl font-semibold">{request.title}</h2>
            <p className="mt-2 text-muted-foreground">
              {request.childAlias} · {formatMoney(request.rewardCents)}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Form method="post">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="decision" value="approve" />
                <Button type="submit">{t("tasks.requests.approve")}</Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="decision" value="reject" />
                <Button type="submit" variant="outline">
                  {t("tasks.requests.reject")}
                </Button>
              </Form>
            </div>
          </article>
        ))}
      </div>
      {!page.requests.length ? (
        <p className="rounded-3xl border bg-card p-6">{t("tasks.requests.empty")}</p>
      ) : null}
    </AppPage>
  );
}
