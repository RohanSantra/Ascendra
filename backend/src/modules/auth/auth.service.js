
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";

import User from "./user.model.js";
import Session from "../sessions/session.model.js";
import PasswordResetToken from "./passwordResetToken.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";
import { sendPasswordResetEmail } from "../../core/utils/email.service.js";

import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    hashRefreshToken,
    hashPassword,
    comparePassword
} from "./auth.utils.js";

import env from "../../config/env.js";

/**
 * Creates a controlled authentication error.
 *
 * @name createAuthError
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} code - Application error code.
 * @returns {AppError} Authentication error.
 */
const createAuthError = (message, statusCode, code) => {
    return new AppError(message, statusCode, code);
};

/**
 * Verifies that a user account can authenticate.
 *
 * @name assertActiveUser
 * @param {Object} user - User document.
 * @returns {void}
 * @throws {AppError} When the account is unavailable.
 */
const assertActiveUser = (user) => {
    if (!user || user.status !== "active") {
        throw createAuthError(
            "Your account is currently unavailable.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.ACCOUNT_SUSPENDED
        );
    }
};

/**
 * Creates a new authenticated session.
 *
 * @name createAuthenticatedSession
 * @param {Object} user - Authenticated user document.
 * @param {Object} requestMetadata - Request metadata.
 * @param {string} [requestMetadata.userAgent] - Client user agent.
 * @param {string} [requestMetadata.ipAddress] - Client IP address.
 * @param {string} [requestMetadata.device] - Client device description.
 * @param {Object} [mongoSession] - Optional MongoDB session.
 * @returns {Promise<Object>} Session and token pair.
 */
const createAuthenticatedSession = async (
    user,
    requestMetadata = {},
    mongoSession = null
) => {
    const refreshTokenExpiry = new Date(
        Date.now() + env.auth.refreshToken.cookieMaxAge
    );

    const sessionId = new mongoose.Types.ObjectId();

    const refreshToken = generateRefreshToken({
        userId: user._id.toString(),
        sessionId: sessionId.toString()
    });

    const sessionData = {
        _id: sessionId,
        user: user._id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        userAgent: requestMetadata.userAgent,
        ipAddress: requestMetadata.ipAddress,
        device: requestMetadata.device,
        lastUsedAt: new Date(),
        expiresAt: refreshTokenExpiry,
        isActive: true
    };

    const [createdSession] = await Session.create(
        [sessionData],
        mongoSession ? { session: mongoSession } : {}
    );

    return {
        session: createdSession,
        accessToken: generateAccessToken({
            userId: user._id.toString(),
            sessionId
        }),
        refreshToken
    };
};

/**
 * Returns safe public user details.
 *
 * @name serializeUser
 * @param {Object} user - User document.
 * @returns {Object} Public user information.
 */
const serializeUser = (user) => {
    return {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone ?? null,
        profileImage: user.profileImage ?? null,
        status: user.status,
        platformRole: user.platformRole
    };
};



/**
 * @name register
 * @description Creates a global user account.
 *
 * Organisation membership is deliberately not created here.
 * Users join organisations through membership requests or invitations.
 *
 * @param {Object} registrationData - Validated registration information.
 * @returns {Promise<Object>} Newly registered global user.
 */
export const register = async (registrationData) => {
    const {
        firstName,
        lastName,
        email,
        password,
        phone
    } = registrationData;

    const existingUser = await User.exists({ email });

    if (existingUser) {
        throw createAuthError(
            "An account with this email address already exists.",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.USER_EMAIL_ALREADY_EXISTS
        );
    }

    const passwordHash = await hashPassword(password);

    try {
        const user = await User.create({
            firstName,
            lastName,
            email,
            passwordHash,
            phone
        });

        return {
            user: serializeUser(user)
        };
    } catch (error) {
        // Handles concurrent registrations that bypass the initial exists check.
        if (error.code === 11000) {
            throw createAuthError(
                "An account with this email address already exists.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.USER_EMAIL_ALREADY_EXISTS
            );
        }

        throw error;
    }
};



/**
 * Authenticates a user and creates a session.
 *
 * @name login
 * @param {Object} credentials - Login credentials.
 * @param {string} credentials.email - User email.
 * @param {string} credentials.password - User password.
 * @param {Object} requestMetadata - Request metadata.
 * @returns {Promise<Object>} Authenticated user and tokens.
 */
export const login = async (credentials, requestMetadata = {}) => {
    const user = await User.findOne({
        email: credentials.email
    }).select("+passwordHash");

    if (!user || !user.passwordHash) {
        throw createAuthError(
            "Invalid email or password.",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.INVALID_CREDENTIALS
        );
    }

    const passwordMatches = await comparePassword(
        credentials.password,
        user.passwordHash
    );

    if (!passwordMatches) {
        throw createAuthError(
            "Invalid email or password.",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.INVALID_CREDENTIALS
        );
    }

    assertActiveUser(user);

    const mongoSession = await mongoose.startSession();

    try {
        let authenticationResult;

        await mongoSession.withTransaction(async () => {
            user.lastLoginAt = new Date();

            await user.save({ session: mongoSession });

            authenticationResult = await createAuthenticatedSession(
                user,
                requestMetadata,
                mongoSession
            );
        });

        return {
            user: serializeUser(user),
            accessToken: authenticationResult.accessToken,
            refreshToken: authenticationResult.refreshToken
        };
    } finally {
        await mongoSession.endSession();
    }
};

/**
 * Rotates an authenticated session's refresh token.
 *
 * The old token hash is replaced inside a MongoDB transaction.
 *
 * @name refreshSession
 * @param {string} refreshToken - Existing refresh token.
 * @returns {Promise<Object>} New access and refresh tokens.
 */
export const refreshSession = async (refreshToken) => {
    if (!refreshToken) {
        throw createAuthError(
            "Refresh token is required.",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.INVALID_REFRESH_TOKEN
        );
    }

    let payload;

    try {
        payload = verifyRefreshToken(refreshToken);
    } catch (error) {
        const expired = error instanceof jwt.TokenExpiredError;

        throw createAuthError(
            expired
                ? "Refresh token has expired."
                : "Refresh token is invalid.",
            HTTP_STATUS.UNAUTHORIZED,
            expired
                ? ERROR_CODES.REFRESH_TOKEN_EXPIRED
                : ERROR_CODES.INVALID_REFRESH_TOKEN
        );
    }

    if (!payload.sub || !payload.sessionId) {
        throw createAuthError(
            "Refresh token is invalid.",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.INVALID_REFRESH_TOKEN
        );
    }

    const oldTokenHash = hashRefreshToken(refreshToken);
    const mongoSession = await mongoose.startSession();

    try {
        let authenticationResult;

        await mongoSession.withTransaction(async () => {
            const now = new Date();

            const existingSession = await Session.findOne({
                _id: payload.sessionId,
                user: payload.sub,
                isActive: true,
                revokedAt: null,
                expiresAt: { $gt: now }
            })
                .select("+refreshTokenHash")
                .session(mongoSession);

            if (!existingSession) {
                throw createAuthError(
                    "Session is expired or revoked.",
                    HTTP_STATUS.UNAUTHORIZED,
                    ERROR_CODES.SESSION_EXPIRED
                );
            }

            if (existingSession.refreshTokenHash !== oldTokenHash) {
                throw createAuthError(
                    "Refresh token is no longer valid.",
                    HTTP_STATUS.UNAUTHORIZED,
                    ERROR_CODES.INVALID_REFRESH_TOKEN
                );
            }

            const user = await User.findById(payload.sub)
                .session(mongoSession);

            assertActiveUser(user);

            const newRefreshToken = generateRefreshToken({
                userId: user._id.toString(),
                sessionId: existingSession._id.toString()
            });

            const newTokenHash = hashRefreshToken(newRefreshToken);

            const updatedSession = await Session.findOneAndUpdate(
                {
                    _id: existingSession._id,
                    user: user._id,
                    refreshTokenHash: oldTokenHash,
                    isActive: true,
                    revokedAt: null,
                    expiresAt: { $gt: now }
                },
                {
                    $set: {
                        refreshTokenHash: newTokenHash,
                        lastUsedAt: now,
                        expiresAt: new Date(
                            Date.now() + env.auth.refreshToken.cookieMaxAge
                        )
                    }
                },
                {
                    returnDocument: "after",
                    runValidators: true,
                    session: mongoSession
                }
            );

            if (!updatedSession) {
                throw createAuthError(
                    "Refresh token is no longer valid.",
                    HTTP_STATUS.UNAUTHORIZED,
                    ERROR_CODES.INVALID_REFRESH_TOKEN
                );
            }

            authenticationResult = {
                user: serializeUser(user),
                accessToken: generateAccessToken({
                    userId: user._id.toString(),
                    sessionId: updatedSession._id
                }),
                refreshToken: newRefreshToken
            };
        });

        return authenticationResult;
    } finally {
        await mongoSession.endSession();
    }
};

/**
 * @name logout
 * @description Revokes the session associated with a refresh token.
 * Allows expired but correctly signed refresh tokens to revoke their sessions.
 * Invalid tokens are handled idempotently.
 * @param {string} refreshToken - Refresh token from the cookie.
 * @returns {Promise<void>}
 */
export const logout = async (refreshToken) => {
    if (!refreshToken) {
        return;
    }

    let payload;

    try {
        payload = verifyRefreshToken(refreshToken, {
            ignoreExpiration: true
        });
    } catch {
        // Invalid signatures or claims cannot be used to revoke a session.
        return;
    }

    if (!payload.sub || !payload.sessionId) {
        return;
    }

    await Session.updateOne(
        {
            _id: payload.sessionId,
            user: payload.sub,
            refreshTokenHash: hashRefreshToken(refreshToken),
            isActive: true,
            revokedAt: null
        },
        {
            $set: {
                isActive: false,
                revokedAt: new Date(),
                revokedReason: "logout"
            }
        }
    );
};

/**
 * Revokes every active session belonging to a user.
 *
 * @name logoutAll
 * @param {string} userId - User identifier.
 * @returns {Promise<number>} Number of sessions revoked.
 */
export const logoutAll = async (userId) => {
    const result = await Session.updateMany(
        {
            user: userId,
            isActive: true,
            revokedAt: null
        },
        {
            $set: {
                isActive: false,
                revokedAt: new Date(),
                revokedReason: "logout_all"
            }
        }
    );

    return result.modifiedCount;
};

/**
 * Changes a user's password and revokes all active sessions.
 *
 * @name changePassword
 * @param {string} userId - Authenticated user identifier.
 * @param {Object} passwords - Password information.
 * @param {string} passwords.currentPassword - Existing password.
 * @param {string} passwords.newPassword - New password.
 * @returns {Promise<void>}
 */
export const changePassword = async (userId, passwords) => {
    if (passwords.currentPassword === passwords.newPassword) {
        throw createAuthError(
            "New password must be different from the current password.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PASSWORD_MISMATCH
        );
    }

    const mongoSession = await mongoose.startSession();

    try {
        await mongoSession.withTransaction(async () => {
            const user = await User.findById(userId)
                .select("+passwordHash")
                .session(mongoSession);

            if (!user) {
                throw createAuthError(
                    "User account was not found.",
                    HTTP_STATUS.NOT_FOUND,
                    ERROR_CODES.USER_NOT_FOUND
                );
            }

            assertActiveUser(user);

            if (!user.passwordHash) {
                throw createAuthError(
                    "Password authentication is not configured for this account.",
                    HTTP_STATUS.BAD_REQUEST,
                    ERROR_CODES.INVALID_CREDENTIALS
                );
            }

            const passwordMatches = await comparePassword(
                passwords.currentPassword,
                user.passwordHash
            );

            if (!passwordMatches) {
                throw createAuthError(
                    "Current password is incorrect.",
                    HTTP_STATUS.UNAUTHORIZED,
                    ERROR_CODES.INVALID_CREDENTIALS
                );
            }

            user.passwordHash = await hashPassword(
                passwords.newPassword
            );

            user.passwordChangedAt = new Date();

            await user.save({ session: mongoSession });

            await Session.updateMany(
                {
                    user: user._id,
                    isActive: true,
                    revokedAt: null
                },
                {
                    $set: {
                        isActive: false,
                        revokedAt: new Date(),
                        revokedReason: "password_changed"
                    }
                },
                { session: mongoSession }
            );
        });
    } finally {
        await mongoSession.endSession();
    }
};

/**
 * Sends a password-reset link when an active account matches the email.
 *
 * The response is intentionally identical for known and unknown addresses
 * to prevent account enumeration.
 *
 * @param {string} email - Normalized account email address.
 * @returns {Promise<void>}
 */
export const requestPasswordReset = async (email) => {
    const user = await User.findOne({
        email,
        status: "active"
    })
        .select("_id email firstName")
        .lean();

    if (!user) {
        return;
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256")
        .update(rawToken)
        .digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await PasswordResetToken.findOneAndUpdate(
        { user: user._id },
        {
            $set: {
                tokenHash,
                expiresAt
            }
        },
        {
            upsert: true,
            returnDocument: "after",
            runValidators: true,
            setDefaultsOnInsert: true
        }
    );

    const resetUrl = new URL("/reset-password", env.client.url);
    resetUrl.searchParams.set("token", rawToken);

    try {
        await sendPasswordResetEmail({
            to: user.email,
            firstName: user.firstName,
            resetUrl: resetUrl.toString(),
            expiresAt
        });
    } catch (emailError) {
        try {
            await PasswordResetToken.deleteOne({
                user: user._id,
                tokenHash
            });
        } catch (cleanupError) {
            logger.error(
                "Failed to remove a password-reset token after email delivery failed.",
                {
                    userId: user._id.toString(),
                    errorName: cleanupError.name
                }
            );
        }

        logger.error(
            "Password-reset email delivery failed.",
            {
                userId: user._id.toString(),
                errorName: emailError.name
            }
        );
    }
};

/**
 * Consumes a valid password-reset token and revokes existing sessions.
 *
 * @param {Object} options - Password-reset information.
 * @param {string} options.token - Raw reset token from the email.
 * @param {string} options.newPassword - New account password.
 * @returns {Promise<void>}
 */
export const resetPassword = async ({ token, newPassword }) => {
    const tokenHash = createHash("sha256")
        .update(token)
        .digest("hex");
    const passwordHash = await hashPassword(newPassword);
    const mongoSession = await mongoose.startSession();

    try {
        await mongoSession.withTransaction(async () => {
            const resetToken = await PasswordResetToken.findOneAndDelete({
                tokenHash,
                expiresAt: { $gt: new Date() }
            }).session(mongoSession);

            if (!resetToken) {
                throw createAuthError(
                    "This password-reset link is invalid or has expired.",
                    HTTP_STATUS.BAD_REQUEST,
                    ERROR_CODES.INVALID_PASSWORD_RESET_TOKEN
                );
            }

            const user = await User.findOne({
                _id: resetToken.user,
                status: "active"
            })
                .select("+passwordHash")
                .session(mongoSession);

            if (!user) {
                throw createAuthError(
                    "This password-reset link is invalid or has expired.",
                    HTTP_STATUS.BAD_REQUEST,
                    ERROR_CODES.INVALID_PASSWORD_RESET_TOKEN
                );
            }

            const now = new Date();
            user.passwordHash = passwordHash;
            user.passwordChangedAt = now;
            await user.save({ session: mongoSession });

            await Session.updateMany(
                {
                    user: user._id,
                    isActive: true,
                    revokedAt: null
                },
                {
                    $set: {
                        isActive: false,
                        revokedAt: now,
                        revokedReason: "password_changed"
                    }
                },
                { session: mongoSession }
            );

            await PasswordResetToken.deleteMany(
                { user: user._id },
                { session: mongoSession }
            );
        });
    } finally {
        await mongoSession.endSession();
    }
};

/**
 * Retrieves the authenticated user's public profile.
 *
 * @name getCurrentUser
 * @param {string} userId - Authenticated user identifier.
 * @returns {Promise<Object>} Public user information.
 */
export const getCurrentUser = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw createAuthError(
            "User account was not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.USER_NOT_FOUND
        );
    }

    assertActiveUser(user);

    return serializeUser(user);
};
