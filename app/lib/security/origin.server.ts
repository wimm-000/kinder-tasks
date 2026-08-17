import { data } from "react-router";

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw data("Origen de solicitud no permitido", { status: 403 });
  }
}
