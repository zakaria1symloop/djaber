// Auth & account forms (03 §1 AUTH-01…09, api-contract §3.1). Messages are i18n keys (`validation.*`).
import { z } from 'zod';
import { email, localeSchema, password } from '../validators';

/** AUTH-01: first / last name 1–80 characters. */
export const personName = z.string().trim().min(1, 'validation.required').max(80, 'validation.length');

export const LoginSchema = z.object({ email, password: z.string().min(1, 'validation.required') });
export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({ firstName: personName, lastName: personName, email, password, locale: localeSchema.optional() });
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const ForgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'validation.passwordMismatch' });
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const ChangePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'validation.required'), newPassword: password, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'validation.passwordMismatch' });
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const ChangeEmailSchema = z.object({ newEmail: email, password: z.string().min(1, 'validation.required') });
export type ChangeEmailInput = z.infer<typeof ChangeEmailSchema>;

export const AcceptInvitationSchema = z.object({ firstName: personName, lastName: personName, password });
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;

export const UpdateProfileSchema = z.object({ firstName: personName, lastName: personName, locale: localeSchema });
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

/** Password strength for the bar of the reset / change password forms: 0 (empty) … 4 (strong). */
export const passwordStrength = (v: string): 0 | 1 | 2 | 3 | 4 => {
  if (!v) return 0;
  let score = 0;
  if (v.length >= 8) score++;
  if (/\p{L}/u.test(v) && /\d/.test(v)) score++;
  if (v.length >= 12) score++;
  if (/[^\p{L}\d]/u.test(v) && /\p{Lu}/u.test(v)) score++;
  return Math.max(1, score) as 1 | 2 | 3 | 4;
};
