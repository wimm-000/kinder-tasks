import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { db } from "~/lib/db/client.server";
import * as schema from "~/lib/db/schema";
import { userProfiles } from "~/lib/db/schema";
import { getServerEnv } from "~/lib/env.server";
import { sendEmail } from "~/services/email/email.server";

const env = getServerEnv();

export const auth = betterAuth({
  appName: "Kinder Tasks",
  baseURL: env.APP_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    env.APP_URL,
    ...(env.NODE_ENV === "production" ? [] : ["http://127.0.0.1:5173"]),
  ],
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    database: {
      generateId: () => uuidv7(),
    },
    ipAddress: {
      ipAddressHeaders: ["x-nf-client-connection-ip"],
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Restablece tu contraseña de Kinder Tasks",
        text: `Abre este enlace durante los próximos 30 minutos para crear una contraseña nueva: ${url}`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verifica tu correo en Kinder Tasks",
        text: `Confirma que este correo es tuyo durante la próxima hora: ${url}`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 30,
    deferSessionRefresh: true,
  },
  user: {
    changeEmail: {
      enabled: true,
    },
    deleteUser: {
      enabled: true,
    },
  },
  account: {
    accountLinking: {
      enabled: false,
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 100,
    customRules: {
      "/sign-up/email": { window: 60 * 60, max: 5 },
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60 * 15, max: 3 },
      "/send-verification-email": { window: 60 * 15, max: 3 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await db
            .insert(userProfiles)
            .values({ userId: createdUser.id })
            .onConflictDoNothing({ target: userProfiles.userId });
        },
      },
    },
    session: {
      create: {
        before: async (newSession) => {
          const profile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.userId, newSession.userId),
            columns: { status: true },
          });

          if (!profile || profile.status !== "active") {
            throw new APIError("FORBIDDEN", { message: "Account is not active" });
          }

          return { data: newSession };
        },
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
