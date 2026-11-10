
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

import { env } from "../../config/index.js";

/**
 * @name generateAccessToken
 * @description Generates a short-lived JWT access token for an authenticated session.
 * @param {Object} payload - User and session identifiers.
 * @param {string} payload.userId - Authenticated user's ID.
 * @param {string} payload.sessionId - Associated session ID.
 * @returns {string} Signed access token.
 */
export const generateAccessToken = ({ userId, sessionId }) => {
    return jwt.sign(
        { sessionId },
        env.auth.accessToken.secret,
        {
            subject: userId,
            expiresIn: env.auth.accessToken.expiresIn,
            issuer: env.app.name,
            audience: "ascendra-client"
        }
    );
};

/**
 * Generates a refresh token associated with a session.
 *
 * @name generateRefreshToken
 * @param {Object} payload - Token payload.
 * @param {string} payload.userId - User identifier.
 * @param {string} payload.sessionId - Session identifier.
 * @returns {string} Signed refresh token.
 */
export const generateRefreshToken = ({ userId, sessionId }) => {
    return jwt.sign(
        {
            sessionId,
            jti: crypto.randomBytes(16).toString("hex")
        },
        env.auth.refreshToken.secret,
        {
            subject: userId,
            expiresIn: env.auth.refreshToken.expiresIn,
            issuer: env.app.name,
            audience: "ascendra-client"
        }
    );
};

/**
 * Verifies an access token.
 *
 * @name verifyAccessToken
 * @param {string} token - Access token.
 * @returns {Object} Decoded token payload.
 */
export const verifyAccessToken = (token) => {
    return jwt.verify(
        token,
        env.auth.accessToken.secret,
        {
            issuer: env.app.name,
            audience: "ascendra-client"
        }
    );
};

/**
 * @name verifyRefreshToken
 * @description Verifies a refresh token, optionally allowing an expired token
 * for session revocation during logout.
 * @param {string} token - Refresh JWT.
 * @param {Object} [options] - Verification options.
 * @param {boolean} [options.ignoreExpiration=false] - Whether to ignore expiry.
 * @returns {Object} Verified JWT payload.
 */
export const verifyRefreshToken = (
    token,
    { ignoreExpiration = false } = {}
) => {
    return jwt.verify(
        token,
        env.auth.refreshToken.secret,
        {
            issuer: env.app.name,
            audience: "ascendra-client",
            ignoreExpiration
        }
    );
};

/**
 * Creates a SHA-256 hash of a refresh token.
 *
 * @name hashRefreshToken
 * @param {string} token - Raw refresh token.
 * @returns {string} SHA-256 hash.
 */
export const hashRefreshToken = (token) => {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
};

/**
 * Hashes a user's password.
 *
 * @name hashPassword
 * @param {string} password - Plain-text password.
 * @returns {Promise<string>} Password hash.
 */
export const hashPassword = async (password) => {
    return bcrypt.hash(
        password,
        env.auth.bcryptSaltRounds
    );
};

/**
 * Compares a password with its stored hash.
 *
 * @name comparePassword
 * @param {string} password - Submitted password.
 * @param {string} passwordHash - Stored password hash.
 * @returns {Promise<boolean>} Whether the passwords match.
 */
export const comparePassword = async (password, passwordHash) => {
    return bcrypt.compare(password, passwordHash);
};

/**
 * Returns secure refresh-token cookie options.
 *
 * @name getRefreshCookieOptions
 * @returns {Object} Express cookie options.
 */
export const getRefreshCookieOptions = () => {
    const isProduction = env.nodeEnv === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: `/api/${env.app.apiVersion}/auth`,
        maxAge: env.auth.refreshToken.cookieMaxAge
    };
};

/**
 * Returns the configured refresh-token cookie name.
 *
 * @name getRefreshCookieName
 * @returns {string} Cookie name.
 */
export const getRefreshCookieName = () => {
    return env.auth.refreshToken.cookieName;
};
