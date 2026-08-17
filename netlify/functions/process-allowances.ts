import { processDueAllowances } from "../../app/services/allowances/allowances.server";

export const config = { schedule: "15 23 * * *" };

export default async function handler() {
  const result = await processDueAllowances(50, 24_000);
  console.info(JSON.stringify({ event: "allowances_processed", ...result }));
  return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
}
