
import { Router } from "express";

import { createRateLimiter } from "../../middleware/index.js";
import validateRequest from "../../middleware/validate.middleware.js";
import { authenticate } from "./auth.middleware.js";

import {
    registerSchema,
    loginSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema
} from "./auth.validation.js";

import {
    registerUser,
    loginUser,
    refreshUserSession,
    logoutUser,
    logoutAllUserSessions,
    getAuthenticatedUser,
    updateUserPassword,
    requestUserPasswordReset,
    resetUserPassword
} from "./auth.controller.js";

const router = Router();
const passwordResetRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many password-reset requests. Please try again later."
});

/**
 * @route POST /api/v1/auth/register
 * @description Registers a new global user account.
 * @access Public
 */
router.post(
    "/register",
    validateRequest(registerSchema, { body: true }),
    registerUser
);

/**
 * @route POST /api/v1/auth/login
 * @description Authenticates a user.
 * @access Public
 */
router.post(
    "/login",
    validateRequest(loginSchema, { body: true }),
    loginUser
);

/**
 * @route POST /api/v1/auth/forgot-password
 * @description Sends a password-reset link when an active account exists.
 * @access Public
 */
router.post(
    "/forgot-password",
    passwordResetRateLimit,
    validateRequest(forgotPasswordSchema, { body: true }),
    requestUserPasswordReset
);

/**
 * @route POST /api/v1/auth/reset-password
 * @description Resets a password using a single-use email token.
 * @access Public
 */
router.post(
    "/reset-password",
    validateRequest(resetPasswordSchema, { body: true }),
    resetUserPassword
);

/**
 * @route POST /api/v1/auth/refresh
 * @description Rotates the refresh token.
 * @access Public (refresh cookie required)
 */
router.post(
    "/refresh",
    refreshUserSession
);

/**
 * @route POST /api/v1/auth/logout
 * @description Revokes the current session.
 * @access Public (refresh cookie used for revocation)
 */
router.post(
    "/logout",
    logoutUser
);

/**
 * @route POST /api/v1/auth/logout-all
 * @description Revokes all sessions for the authenticated user.
 * @access Private
 */
router.post(
    "/logout-all",
    authenticate,
    logoutAllUserSessions
);

/**
 * @route GET /api/v1/auth/me
 * @description Retrieves the authenticated user's profile.
 * @access Private
 */
router.get(
    "/me",
    authenticate,
    getAuthenticatedUser
);

/**
 * @route PATCH /api/v1/auth/change-password
 * @description Changes the authenticated user's password.
 * @access Private
 */
router.patch(
    "/change-password",
    authenticate,
    validateRequest(changePasswordSchema, { body: true }),
    updateUserPassword
);

export default router;
