import { and, eq } from "drizzle-orm";

import { db } from "~/lib/db/client.server";
import { userProfiles } from "~/lib/db/schema";
import { getServerEnv } from "~/lib/env.server";
import { writeAuditLog } from "~/services/audit/audit.server";

interface BootstrapUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

export async function bootstrapSuperadmin(user: BootstrapUser): Promise<boolean> {
  const configuredEmails = getServerEnv().SUPERADMIN_EMAILS;
  if (!user.emailVerified || !configuredEmails.includes(user.email.trim().toLowerCase())) {
    return false;
  }

  const updated = await db
    .update(userProfiles)
    .set({ globalRole: "superadmin" })
    .where(
      and(
        eq(userProfiles.userId, user.id),
        eq(userProfiles.status, "active"),
        eq(userProfiles.globalRole, "user"),
      ),
    )
    .returning({ userId: userProfiles.userId });

  if (updated.length === 0) return false;

  await writeAuditLog({
    actor: { type: "system" },
    action: "superadmin.bootstrap",
    targetType: "user",
    targetId: user.id,
    result: "success",
  });
  return true;
}
