import { z } from "zod";

import { parseMoneyToCents } from "~/domain/money/money";

const amount = z
  .string()
  .trim()
  .refine((value) => {
    try {
      parseMoneyToCents(value);
      return true;
    } catch {
      return false;
    }
  }, "Escribe un importe válido mayor que cero.");
const description = z
  .string()
  .trim()
  .min(2, "Escribe un motivo.")
  .max(200, "El motivo es demasiado largo.");

export const withdrawalSchema = z.object({ childId: z.string().uuid(), amount, description });
export const adjustmentSchema = z.object({
  childId: z.string().uuid(),
  kind: z.enum(["credit", "debit"]),
  amount,
  description,
});
