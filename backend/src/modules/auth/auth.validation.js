
import { z } from "zod";


/**
 * @name registerSchema
 * @description Validates global user account registration details.
 */
export const registerSchema = z.object({
    body: z.object({
        firstName: z.string().trim().min(2).max(60),
        lastName: z.string().trim().min(1).max(60),
        email: z.string().trim().email().max(254).transform(
            (value) => value.toLowerCase()
        ),
        password: z.string().min(8).max(128),
        phone: z.string().trim().max(20).optional()
    }).strict()
});



/**
 * Login request validation.
 *
 * @name loginSchema
 */
export const loginSchema = z.object({
    body: z.object({
        email: z.string().trim().email().max(254).transform(
            (value) => value.toLowerCase()
        ),
        password: z.string().min(1).max(128)
    }).strict()
});

/**
 * Refresh-token request validation.
 *
 * @name refreshTokenSchema
 */
export const refreshTokenSchema = z.object({
    body: z.object({}).strict()
});

/**
 * Change-password request validation.
 *
 * @name changePasswordSchema
 */
export const changePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(8).max(128)
    }).strict()
});

/**
 * Forgot-password request validation.
 *
 * @name forgotPasswordSchema
 */
export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().trim().email().max(254).transform(
            (value) => value.toLowerCase()
        )
    }).strict()
});

/**
 * Reset-password request validation.
 *
 * @name resetPasswordSchema
 */
export const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().regex(/^[a-f0-9]{64}$/i),
        newPassword: z.string().min(8).max(128)
    }).strict()
});
