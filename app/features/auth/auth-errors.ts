import { t } from "~/lib/i18n";

interface PublicAuthError {
  status?: number;
  code?: string;
}

export function getAuthErrorMessage(error: PublicAuthError | null): string {
  if (!error) return t("auth.error.generic");
  if (error.status === 429) return t("auth.error.rateLimited");
  if (error.status === 403 || error.code === "EMAIL_NOT_VERIFIED") {
    return t("auth.error.emailNotVerified");
  }
  if (error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD") {
    return t("auth.error.invalidCredentials");
  }
  return t("auth.error.generic");
}
