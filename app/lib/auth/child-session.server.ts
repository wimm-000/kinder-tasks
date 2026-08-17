import { createHash, randomBytes } from "node:crypto";

import { createCookie } from "react-router";

import { getServerEnv } from "~/lib/env.server";

const secure = getServerEnv().NODE_ENV === "production";
const common = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };

export const childDeviceCookie = createCookie("kt_child_device", {
  ...common,
  maxAge: 90 * 24 * 60 * 60,
});
export const childSessionCookie = createCookie("kt_child_session", {
  ...common,
  maxAge: 30 * 24 * 60 * 60,
});
export const childCsrfCookie = createCookie("kt_child_csrf", {
  ...common,
  httpOnly: false,
  maxAge: 30 * 24 * 60 * 60,
});

export function createSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export async function readCookie(
  cookie: { parse(value: string | null): Promise<unknown> },
  request: Request,
) {
  const value = await cookie.parse(request.headers.get("cookie"));
  return typeof value === "string" ? value : null;
}

export async function clearChildCookies(clearDevice = false) {
  const values = [
    await childSessionCookie.serialize("", { maxAge: 0 }),
    await childCsrfCookie.serialize("", { maxAge: 0 }),
  ];
  if (clearDevice) values.push(await childDeviceCookie.serialize("", { maxAge: 0 }));
  return values;
}
