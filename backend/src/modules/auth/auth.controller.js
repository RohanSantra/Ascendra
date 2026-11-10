
import {
    register,
    login,
    refreshSession,
    logout,
    logoutAll,
    changePassword,
    getCurrentUser,
    requestPasswordReset,
    resetPassword
} from "./auth.service.js";

import {
    getRefreshCookieName,
    getRefreshCookieOptions
} from "./auth.utils.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import { asyncHandler } from "../../core/utils/index.js";

/**
 * @name setRefreshCookie
 * @description Stores the refresh token in an HTTP-only cookie.
 * @param {Object} res - Express response.
 * @param {string} refreshToken - Refresh token.
 */
const setRefreshCookie = (res, refreshToken) => {
    res.cookie(
        getRefreshCookieName(),
        refreshToken,
        getRefreshCookieOptions()
    );
};

/**
 * @name clearRefreshCookie
 * @description Clears the refresh-token cookie.
 * @param {Object} res - Express response.
 */
const clearRefreshCookie = (res) => {
    const {
        ...cookieOptions
    } = getRefreshCookieOptions();

    res.clearCookie(
        getRefreshCookieName(),
        cookieOptions
    );
};

/**
 * @name getRequestMetadata
 * @description Extracts client metadata for session tracking.
 * @param {Object} req - Express request.
 * @returns {Object} Request metadata.
 */
const getRequestMetadata = (req) => ({
    userAgent: req.get("user-agent"),
    ipAddress: req.ip
});


/**
 * @name registerUser
 * @description Registers a new global user account.
 */
export const registerUser = asyncHandler(async (req, res) => {
    const result = await register(req.validated.body);

    return ApiResponse.created(
        res,
        "Account created successfully. You can now join an organization or accept an invitation.",
        result
    );
});



/**
 * @name loginUser
 * @description Authenticates a user and creates a session.
 */
export const loginUser = asyncHandler(async (req, res) => {
    const result = await login(
        req.validated.body,
        getRequestMetadata(req)
    );

    setRefreshCookie(res, result.refreshToken);

    return ApiResponse.ok(res, "Login successful.", {
        user: result.user,
        accessToken: result.accessToken
    });
});

/**
 * @name refreshUserSession
 * @description Rotates the refresh token and issues a new access token.
 */
export const refreshUserSession = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[getRefreshCookieName()];

    const result = await refreshSession(refreshToken);

    setRefreshCookie(res, result.refreshToken);

    return ApiResponse.ok(res, "Session refreshed.", {
        user: result.user,
        accessToken: result.accessToken
    });
});

/**
 * @name logoutUser
 * @description Revokes the current session and clears its cookie.
 */
export const logoutUser = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[getRefreshCookieName()];

    await logout(refreshToken);

    clearRefreshCookie(res);

    return ApiResponse.ok(res, "Logout successful.");
});

/**
 * @name logoutAllUserSessions
 * @description Revokes all active sessions belonging to the user.
 */
export const logoutAllUserSessions = asyncHandler(async (req, res) => {
    const revokedSessions = await logoutAll(req.user.userId);

    clearRefreshCookie(res);

    return ApiResponse.ok(res, "All sessions have been revoked.", {
        revokedSessions
    });
});

/**
 * @name getAuthenticatedUser
 * @description Returns the current authenticated user's profile.
 */
export const getAuthenticatedUser = asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req.user.userId);

    return ApiResponse.ok(res, "User profile retrieved successfully.", {
        user
    });
});

/**
 * @name updateUserPassword
 * @description Changes the current user's password.
 */
export const updateUserPassword = asyncHandler(async (req, res) => {
    await changePassword(
        req.user.userId,
        req.validated.body
    );

    clearRefreshCookie(res);

    return ApiResponse.ok(
        res,
        "Password changed successfully. Please log in again."
    );
});

/**
 * Requests a password-reset link for an account.
 */
export const requestUserPasswordReset = asyncHandler(
    async (req, res) => {
        await requestPasswordReset(req.validated.body.email);

        return ApiResponse.ok(
            res,
            "If an active account matches that email address, a password-reset link will be sent."
        );
    }
);

/**
 * Resets a user's password using a single-use email token.
 */
export const resetUserPassword = asyncHandler(async (req, res) => {
    await resetPassword(req.validated.body);

    return ApiResponse.ok(
        res,
        "Password reset successfully. Please log in again."
    );
});
