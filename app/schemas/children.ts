import { z } from "zod";

import { CHILD_AVATARS, CHILD_COLORS } from "~/features/children/profile-options";

const pin = z.string().regex(/^\d{4,6}$/, "El PIN debe tener entre 4 y 6 cifras.");

export const childProfileSchema = z.object({
  alias: z.string().trim().min(1, "Escribe un alias.").max(40, "El alias es demasiado largo."),
  avatarKey: z.enum(CHILD_AVATARS),
  profileColor: z.enum(CHILD_COLORS),
});

export const createChildSchema = childProfileSchema
  .extend({
    pin,
    confirmPin: pin,
  })
  .refine((input) => input.pin === input.confirmPin, {
    path: ["confirmPin"],
    message: "Los PIN no coinciden.",
  });

export const resetChildPinSchema = z
  .object({ pin, confirmPin: pin })
  .refine((input) => input.pin === input.confirmPin, {
    path: ["confirmPin"],
    message: "Los PIN no coinciden.",
  });

export const authorizeDeviceSchema = z.object({
  name: z.string().trim().min(2, "Escribe un nombre para el dispositivo.").max(80),
});

export const unlockChildSchema = z.object({ pin });
