import { z } from "zod";

export const familySchema = z.object({
  name: z.string().trim().min(2, "Escribe un nombre de entre 2 y 80 caracteres.").max(80),
});

export const createFamilySchema = familySchema.extend({
  clientRequestId: z.uuid(),
});

export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Escribe un correo válido.").max(254),
});

export type FamilyInput = z.infer<typeof familySchema>;
