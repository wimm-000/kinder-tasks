import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/kids-tasks-pending";
import { KidsPage } from "~/components/layout/kids-page";
import { Button } from "~/components/ui/button";
import { t } from "~/lib/i18n";
import { requireChildContext } from "~/services/children/child-auth.server";
import { db } from "~/lib/db/client.server";
import { and, desc, eq } from "drizzle-orm";
import { taskCompletionRequests, tasks } from "~/lib/db/schema";
export async function loader({ request }: Route.LoaderArgs) {
  const context = await requireChildContext(request);
  const requests = await db
    .select({
      id: taskCompletionRequests.id,
      title: tasks.title,
      status: taskCompletionRequests.status,
      requestedAt: taskCompletionRequests.requestedAt,
    })
    .from(taskCompletionRequests)
    .innerJoin(
      tasks,
      and(
        eq(taskCompletionRequests.taskId, tasks.id),
        eq(taskCompletionRequests.familyId, tasks.familyId),
      ),
    )
    .where(
      and(
        eq(taskCompletionRequests.childId, context.childId),
        eq(taskCompletionRequests.familyId, context.familyId),
      ),
    )
    .orderBy(desc(taskCompletionRequests.requestedAt))
    .limit(30);
  return { requests };
}
export default function PendingTasks() {
  const page = useLoaderData<typeof loader>();
  return (
    <KidsPage title={t("tasks.pending.title")} description={t("tasks.pending.description")}>
      <Button variant="ghost" asChild>
        <Link to="/kids/tasks">Volver</Link>
      </Button>
      <div className="mt-6 space-y-3">
        {page.requests.map((request) => (
          <article className="rounded-3xl border bg-card/90 p-5" key={request.id}>
            <h2 className="font-bold">{request.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{request.status}</p>
          </article>
        ))}
      </div>
    </KidsPage>
  );
}
