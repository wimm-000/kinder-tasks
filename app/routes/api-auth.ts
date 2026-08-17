import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { auth } from "~/lib/auth/auth.server";
import { getAdultSession } from "~/lib/auth/session.server";

const publicAuthPaths = new Set([
  "/api/auth/sign-up/email",
  "/api/auth/sign-in/email",
  "/api/auth/verify-email",
  "/api/auth/send-verification-email",
  "/api/auth/request-password-reset",
  "/api/auth/reset-password",
  "/api/auth/sign-out",
]);

async function handleAuthRequest(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;

  if (publicAuthPaths.has(path) || path.startsWith("/api/auth/reset-password/")) {
    return auth.handler(request);
  }

  if (path === "/api/auth/get-session") {
    if (!(await getAdultSession(request))) {
      return Response.json(null);
    }
    return auth.handler(request);
  }

  if (!(await getAdultSession(request))) {
    return Response.json({ code: "FORBIDDEN", message: "Access denied" }, { status: 403 });
  }

  return auth.handler(request);
}

export function loader({ request }: LoaderFunctionArgs) {
  return handleAuthRequest(request);
}

export function action({ request }: ActionFunctionArgs) {
  return handleAuthRequest(request);
}
