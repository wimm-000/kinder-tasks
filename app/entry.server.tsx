import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  const rootData = routerContext.staticHandlerContext.loaderData.root as
    { nonce?: unknown } | undefined;
  const nonce = typeof rootData?.nonce === "string" ? rootData.nonce : undefined;
  let statusCode = responseStatusCode;
  let shellRendered = false;

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} nonce={nonce} url={request.url} />,
    {
      nonce,
      onError(error) {
        statusCode = 500;
        if (shellRendered) {
          console.error(
            JSON.stringify({
              event: "ssr_render_error",
              message: error instanceof Error ? error.message : "Unknown rendering error",
            }),
          );
        }
      },
    },
  );
  shellRendered = true;

  if (isbot(request.headers.get("user-agent")) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("content-type", "text/html; charset=utf-8");
  return new Response(body, {
    headers: responseHeaders,
    status: statusCode,
  });
}
