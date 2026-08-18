import { eq } from "drizzle-orm";
import { redirect } from "react-router";

import { db } from "~/lib/db/client.server";
import { userProfiles } from "~/lib/db/schema";
import { bootstrapSuperadmin } from "~/services/admin/bootstrap.server";
import { writeAuditLog } from "~/services/audit/audit.server";

import { auth, type AuthSession } from "./auth.server";

export interface AdultSessionContext {
  auth: AuthSession;
  profile: {
    globalRole: "user" | "superadmin";
    status: "active";
    locale: string;
  };
}

export interface SuperadminSessionContext extends AdultSessionContext {
  profile: AdultSessionContext["profile"] & { globalRole: "superadmin" };
}

export async function getAdultSession(request: Request): Promise<AdultSessionContext | null> {
  const currentSession = await auth.api.getSession({ headers: request.headers });
  if (!currentSession) return null;

  await bootstrapSuperadmin({
    id: currentSession.user.id,
    email: currentSession.user.email,
    emailVerified: currentSession.user.emailVerified,
  });

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, currentSession.user.id),
    columns: { globalRole: true, status: true, locale: true },
  });

  if (!profile || profile.status !== "active") return null;
  if (profile.globalRole !== "user" && profile.globalRole !== "superadmin") return null;

  return {
    auth: currentSession,
    profile: {
      globalRole: profile.globalRole,
      status: "active",
      locale: profile.locale,
    },
  };
}

export async function requireAdultSession(request: Request): Promise<AdultSessionContext> {
  const context = await getAdultSession(request);
  if (!context) {
    const url = new URL(request.url);
    const destination = encodeURIComponent(`${url.pathname}${url.search}`);
    throw redirect(`/login?redirectTo=${destination}`);
  }
  return context;
}

export async function requireSuperadmin(request: Request): Promise<SuperadminSessionContext> {
  const context = await requireAdultSession(request);
  if (context.profile.globalRole !== "superadmin") {
    await writeAuditLog({
      actor: { type: "user", userId: context.auth.user.id },
      action: "superadmin.access",
      targetType: "admin",
      result: "denied",
      request,
    });
    throw new Response("Forbidden", { status: 403 });
  }

  return {
    ...context,
    profile: { ...context.profile, globalRole: "superadmin" },
  };
}

export async function redirectAuthenticatedAdult(request: Request): Promise<void> {
  if (await getAdultSession(request)) throw redirect("/app");
}
