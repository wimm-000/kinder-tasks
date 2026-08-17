import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12).max(128);

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email,
    password,
    confirmPassword: password,
    acceptTerms: z.boolean().refine(Boolean),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "password_mismatch",
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
  rememberMe: z.boolean(),
});

export const emailSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: password,
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "password_mismatch",
  });

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
    confirmPassword: password,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "password_mismatch",
  });

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirmation: z.literal("ELIMINAR"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export function safeRedirect(value: string | null | undefined, fallback = "/app"): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
