// Request DTOs of the auth module (api-contract §3.1, 03 §1 AUTH-01…09).
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { email, localeSchema, password, phoneDz } from '@djaber/shared';

/** AUTH-01: first name, last name 1–80. */
const personName = z.string().trim().min(1, 'validation.required').max(80, 'validation.length');
const currentPassword = z.string().min(1, 'validation.required').max(128, 'validation.length');
const token = z.string().trim().min(16, 'validation.invalid').max(512, 'validation.invalid');
const totpCode = z.string().trim().max(12, 'validation.length').optional().nullable();
const device = z
  .object({
    platform: z.enum(['web', 'android', 'ios']),
    name: z.string().trim().max(120).optional(),
    appVersion: z.string().trim().max(30).optional(),
  })
  .strict()
  .optional();

export const RegisterSchema = z
  .object({
    firstName: personName,
    lastName: personName,
    email,
    password,
    locale: localeSchema.optional(),
    /** optional shop name; default "Boutique de {firstName}" */
    workspaceName: z.string().trim().min(1, 'validation.required').max(120, 'validation.length').optional(),
    /** sign-up from an invitation link: joins the inviter's workspace, creates none (D30) */
    invitationToken: token.optional(),
    device,
  })
  .strict();
export class RegisterDto extends createZodDto(RegisterSchema) {}
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({ email, password: currentPassword, device }).strict();
export class LoginDto extends createZodDto(LoginSchema) {}
export type LoginInput = z.infer<typeof LoginSchema>;

/** The body is optional on the web (the token travels in the cookie). */
export const RefreshSchema = z.preprocess((v) => v ?? {}, z.object({ refreshToken: token.optional() }).strict());
export class RefreshDto extends createZodDto(RefreshSchema) {}

export const ForgotPasswordSchema = z.object({ email }).strict();
export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}

export const ResetPasswordSchema = z.object({ token, password, device }).strict();
export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

export const VerifyEmailSchema = z.object({ token }).strict();
export class VerifyEmailDto extends createZodDto(VerifyEmailSchema) {}

export const TwoFaEnableSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'validation.invalid') }).strict();
export class TwoFaEnableDto extends createZodDto(TwoFaEnableSchema) {}

export const PasswordConfirmSchema = z.object({ password: currentPassword, totpCode }).strict();
export class PasswordConfirmDto extends createZodDto(PasswordConfirmSchema) {}

export const TwoFaVerifySchema = z
  .object({
    mfaToken: z.string().min(20, 'validation.invalid').max(2048, 'validation.invalid'),
    code: z.string().trim().max(12).optional(),
    recoveryCode: z.string().trim().max(40).optional(),
    device,
  })
  .strict()
  .refine((v) => !!v.code || !!v.recoveryCode, { message: 'validation.required', path: ['code'] });
export class TwoFaVerifyDto extends createZodDto(TwoFaVerifySchema) {}

// --- /me ---------------------------------------------------------------------------------------------------------------
export const UpdateMeSchema = z
  .object({
    firstName: personName.optional(),
    lastName: personName.optional(),
    phone: phoneDz.nullable().optional(),
    locale: localeSchema.optional(),
    /** id returned by `POST /uploads { kind: 'avatar' }`; null removes the avatar */
    avatarUploadId: z.string().uuid('validation.id').nullable().optional(),
  })
  .strict();
export class UpdateMeDto extends createZodDto(UpdateMeSchema) {}
export type UpdateMe = z.infer<typeof UpdateMeSchema>;

export const PrefsSchema = z
  .object({
    listDensity: z.enum(['compact', 'comfortable']).optional(),
    soundOnMessage: z.boolean().optional(),
    dismissedAnnouncementIds: z.array(z.string().max(64)).max(100).optional(),
    reportFavorites: z.array(z.string().max(64)).max(100).optional(),
  })
  .strict();
export class PrefsDto extends createZodDto(PrefsSchema) {}
export type PrefsInput = z.infer<typeof PrefsSchema>;

export const ChangePasswordSchema = z.object({ currentPassword, newPassword: password }).strict();
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}

export const EmailChangeSchema = z.object({ email, password: currentPassword }).strict();
export class EmailChangeDto extends createZodDto(EmailChangeSchema) {}

export const DeletionRequestSchema = z.object({ password: currentPassword, totpCode }).strict();
export class DeletionRequestDto extends createZodDto(DeletionRequestSchema) {}
