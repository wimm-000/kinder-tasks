import { runRetention } from "../../app/services/privacy/retention.server";

export default async () => {
  const result = await runRetention();
  console.info(JSON.stringify({ type: "retention_completed", ...result }));
  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { schedule: "17 3 * * *" };
