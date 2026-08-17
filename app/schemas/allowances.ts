import { z } from "zod";

import { parseMoneyToCents } from "~/domain/money/money";

export const allowanceSchema = z
  .object({
    amount: z
      .string()
      .trim()
      .refine((value) => {
        try {
          parseMoneyToCents(value);
          return true;
        } catch {
          return false;
        }
      }, "Escribe un importe válido."),
    frequency: z.enum(["weekly", "monthly"]),
    weekday: z.coerce.number().int().min(1).max(7).optional(),
    monthDay: z.coerce.number().int().min(1).max(31).optional(),
    startDate: z.iso.date(),
  })
  .refine(
    (value) =>
      value.frequency === "weekly"
        ? Boolean(value.weekday) && !value.monthDay
        : Boolean(value.monthDay) && !value.weekday,
    { message: "Completa la frecuencia de la paga." },
  );
