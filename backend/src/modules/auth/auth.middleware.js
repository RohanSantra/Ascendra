
import User from "./user.model.js";
import Session from "../sessions/session.model.js";

import { HTTP_STATUS, ERROR_CODES } from "../../core/constants/index.js";
import AppError from "../../core/errors/AppError.js";
import { asyncHandler } from "../../core/utils/index.js";

import { verifyAccessToken } from "./auth.utils.js";

/**
 * @name authenticate
 * @description Verifies the access token and validates the associated user and session.
 * Attaches authenticated user details to req.user.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
        throw new AppError(
            "Authentication is required.",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.AUTH_REQUIRED
        );
    }

    const accessToken = authorization.split(" ")[1];

    if (!accessToken) {
        throw new AppError(
            "Invalid authentication token.",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.INVALID_ACCESS_TOKEN
        );
    }

    let decodedToken;

    try {
        decodedToken = verifyAccessToken(accessToken);
    } catch (error) {
        const isExpired = error.name === "TokenExpiredError";

        throw new AppError(
            isExpired
                ? "Access token has expired."
                : "Invalid access token.",
            HTTP_STATUS.UNAUTHORIZED,
            isExpired
                ? ERROR_CODES.ACCESS_TOKEN_EXPIRED
                : ERROR_CODES.INVALID_ACCESS_TOKEN
        );
    }

    const { sub: userId, sessionId, iat } = decodedToken;

    if (!userId || !sessionId || !iat) {
        throw new AppError(
            "Invalid access token.",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.INVALID_ACCESS_TOKEN
        );
    }

    const session = await Session.findOne({
        _id: sessionId,
        user: userId,
        isActive: true,
        revokedAt: null,
        expiresAt: { $gt: new Date() }
    }).lean();

    if (!session) {
        throw new AppError(
            "Your session has expired or been revoked.",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.SESSION_EXPIRED
        );
    }

    const user = await User.findById(userId)
        .select("_id firstName lastName email status platformRole passwordChangedAt")
        .lean();

    if (!user) {
        throw new AppError(
            "User account was not found.",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.USER_NOT_FOUND
        );
    }

    if (user.status !== "active") {
        throw new AppError(
            "Your account is currently unavailable.",
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.ACCOUNT_SUSPENDED
        );
    }

    if (
        user.passwordChangedAt &&
        iat * 1000 < user.passwordChangedAt.getTime()
    ) {
        throw new AppError(
            "Your session is no longer valid. Please log in again.",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.SESSION_REVOKED
        );
    }

    req.user = {
        userId: user._id.toString(),
        sessionId: session._id.toString(),
        platformRole: user.platformRole,
        role: undefined
    };

    next();
});
