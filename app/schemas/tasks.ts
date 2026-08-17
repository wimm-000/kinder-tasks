import { z } from "zod";

import { parseMoneyToCents } from "~/domain/money/money";

export const taskSchema = z
  .object({
    title: z.string().trim().min(2, "Escribe un título.").max(100),
    description: z.string().trim().max(500).optional(),
    type: z.enum(["one_off", "recurring", "open"]),
    reward: z
      .string()
      .trim()
      .refine(
        (value) =>
          value === "0" ||
          (() => {
            try {
              parseMoneyToCents(value);
              return true;
            } catch {
              return false;
            }
          })(),
        "Escribe una recompensa válida.",
      ),
    recurrenceUnit: z.enum(["daily", "weekly", "monthly"]).optional(),
    recurrenceInterval: z.coerce.number().int().min(1).max(365).optional(),
    recurrenceWeekday: z.coerce.number().int().min(1).max(7).optional(),
    recurrenceMonthDay: z.coerce.number().int().min(1).max(31).optional(),
    openLimitCount: z.coerce.number().int().min(1).max(100).optional(),
    openLimitPeriod: z.enum(["day", "week", "month"]).optional(),
    childIds: z.array(z.string().uuid()).min(1, "Asigna al menos un perfil."),
  })
  .superRefine((value, context) => {
    if (value.type === "recurring" && !value.recurrenceUnit)
      context.addIssue({
        code: "custom",
        path: ["recurrenceUnit"],
        message: "Elige una recurrencia.",
      });
    if (value.type === "open" && (!value.openLimitCount || !value.openLimitPeriod))
      context.addIssue({
        code: "custom",
        path: ["openLimitCount"],
        message: "Configura el límite de la tarea abierta.",
      });
  });

export const completionRequestSchema = z.object({
  assignmentId: z.string().uuid(),
  clientRequestId: z.string().uuid(),
});
export const reviewRequestSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().max(300).optional(),
});
