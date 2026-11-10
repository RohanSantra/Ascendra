
import test, {
    before,
    after,
    beforeEach
} from "node:test";

import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import {
    startTestDatabase,
    clearTestDatabase,
    stopTestDatabase
} from "../../helpers/database.js";

import User from "../../../src/modules/auth/user.model.js";
import Session from "../../../src/modules/sessions/session.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../src/core/constants/index.js";

import AppError from "../../../src/core/errors/AppError.js";

import env from "../../../src/config/env.js";

import {
    hashPassword,
    comparePassword,
    hashRefreshToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
} from "../../../src/modules/auth/auth.utils.js";

import {
    register,
    login,
    refreshSession,
    logout,
    logoutAll,
    changePassword,
    getCurrentUser
} from "../../../src/modules/auth/auth.service.js";


let user;


const assertAuthError = async (
    operation,
    expectedCode,
    expectedStatus
) => {
    await assert.rejects(
        operation,
        (error) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.code, expectedCode);
            assert.equal(error.statusCode, expectedStatus);

            return true;
        }
    );
};


const createTestUser = async (overrides = {}) => {
    return User.create({
        firstName: "Test",
        lastName: "User",
        email: "test.user@example.com",
        passwordHash: await hashPassword("OriginalPassword123"),
        ...overrides
    });
};


const createTestSession = async (
    userId,
    options = {}
) => {
    const sessionId = new mongoose.Types.ObjectId();

    const refreshToken = options.refreshToken ??
        generateRefreshToken({
            userId: userId.toString(),
            sessionId: sessionId.toString()
        });

    const payload = verifyRefreshToken(refreshToken);

    const session = await Session.create({
        _id: payload.sessionId,
        user: userId,
        refreshTokenHash: options.refreshTokenHash ??
            hashRefreshToken(refreshToken),
        expiresAt: options.expiresAt ??
            new Date(Date.now() + 60 * 60 * 1000),
        isActive: options.isActive ?? true,
        revokedAt: options.revokedAt ?? null,
        ...options.sessionData
    });

    return {
        session,
        refreshToken
    };
};


before(async () => {
    await startTestDatabase();
});


after(async () => {
    await stopTestDatabase();
});


beforeEach(async () => {
    await clearTestDatabase();

    user = await createTestUser();
});


/* -------------------------------------------------------------------------- */
/* Registration                                                               */
/* -------------------------------------------------------------------------- */

test(
    "registers a new user and returns safe public details",
    async () => {
        const result = await register({
            firstName: "New",
            lastName: "User",
            email: "new.user@example.com",
            password: "NewPassword123",
            phone: "9876543210"
        });

        assert.ok(result.user.id);
        assert.equal(result.user.firstName, "New");
        assert.equal(result.user.lastName, "User");
        assert.equal(result.user.email, "new.user@example.com");
        assert.equal(result.user.phone, "9876543210");
        assert.equal(result.user.status, "active");
        assert.equal(result.user.platformRole, "user");

        assert.equal(
            Object.hasOwn(result.user, "passwordHash"),
            false
        );

        const savedUser = await User.findOne({
            email: "new.user@example.com"
        }).select("+passwordHash");

        assert.ok(savedUser);

        assert.equal(
            await comparePassword(
                "NewPassword123",
                savedUser.passwordHash
            ),
            true
        );

        assert.equal(
            await Session.countDocuments({
                user: savedUser._id
            }),
            0
        );
    }
);


test(
    "rejects registration when the email already exists",
    async () => {
        await assertAuthError(
            register({
                firstName: "Another",
                lastName: "User",
                email: user.email,
                password: "AnotherPassword123"
            }),
            ERROR_CODES.USER_EMAIL_ALREADY_EXISTS,
            HTTP_STATUS.CONFLICT
        );

        assert.equal(await User.countDocuments(), 1);
    }
);


/* -------------------------------------------------------------------------- */
/* Login                                                                      */
/* -------------------------------------------------------------------------- */

test(
    "authenticates an active user and creates a session",
    async () => {
        const result = await login(
            {
                email: user.email,
                password: "OriginalPassword123"
            },
            {
                userAgent: "Ascendra Test Browser",
                ipAddress: "127.0.0.1",
                device: "Test Desktop"
            }
        );

        assert.equal(result.user.id, user._id.toString());
        assert.equal(result.user.email, user.email);

        assert.ok(result.accessToken);
        assert.ok(result.refreshToken);

        const accessPayload = verifyAccessToken(
            result.accessToken
        );

        const refreshPayload = verifyRefreshToken(
            result.refreshToken
        );

        assert.equal(
            accessPayload.sub,
            user._id.toString()
        );

        assert.equal(
            refreshPayload.sub,
            user._id.toString()
        );

        assert.ok(accessPayload.sessionId);
        assert.equal(
            accessPayload.sessionId,
            refreshPayload.sessionId
        );

        const savedSession = await Session.findById(
            accessPayload.sessionId
        )
            .select("+refreshTokenHash")
            .lean();

        assert.ok(savedSession);
        assert.equal(
            savedSession.user.toString(),
            user._id.toString()
        );

        assert.equal(savedSession.isActive, true);
        assert.equal(savedSession.userAgent, "Ascendra Test Browser");
        assert.equal(savedSession.ipAddress, "127.0.0.1");
        assert.equal(savedSession.device, "Test Desktop");

        assert.equal(
            savedSession.refreshTokenHash,
            hashRefreshToken(result.refreshToken)
        );

        assert.notEqual(
            savedSession.refreshTokenHash,
            result.refreshToken
        );

        const updatedUser = await User.findById(user._id);

        assert.ok(updatedUser.lastLoginAt);
    }
);


test(
    "rejects login when the email does not exist",
    async () => {
        await assertAuthError(
            login({
                email: "missing.user@example.com",
                password: "OriginalPassword123"
            }),
            ERROR_CODES.INVALID_CREDENTIALS,
            HTTP_STATUS.UNAUTHORIZED
        );

        assert.equal(await Session.countDocuments(), 0);
    }
);


test(
    "rejects login when the password is incorrect",
    async () => {
        await assertAuthError(
            login({
                email: user.email,
                password: "IncorrectPassword123"
            }),
            ERROR_CODES.INVALID_CREDENTIALS,
            HTTP_STATUS.UNAUTHORIZED
        );

        assert.equal(await Session.countDocuments(), 0);
    }
);


test(
    "rejects login when the account is suspended",
    async () => {
        user.status = "suspended";
        await user.save();

        await assertAuthError(
            login({
                email: user.email,
                password: "OriginalPassword123"
            }),
            ERROR_CODES.ACCOUNT_SUSPENDED,
            HTTP_STATUS.FORBIDDEN
        );

        assert.equal(await Session.countDocuments(), 0);
    }
);


test(
    "rejects login when the account is deactivated",
    async () => {
        user.status = "deactivated";
        await user.save();

        await assertAuthError(
            login({
                email: user.email,
                password: "OriginalPassword123"
            }),
            ERROR_CODES.ACCOUNT_SUSPENDED,
            HTTP_STATUS.FORBIDDEN
        );

        assert.equal(await Session.countDocuments(), 0);
    }
);


/* -------------------------------------------------------------------------- */
/* Refresh token rotation                                                     */
/* -------------------------------------------------------------------------- */

test(
    "rotates a valid refresh token and preserves the session",
    async () => {
        const loginResult = await login({
            email: user.email,
            password: "OriginalPassword123"
        });

        const oldRefreshToken = loginResult.refreshToken;
        const oldPayload = verifyRefreshToken(oldRefreshToken);

        const oldSession = await Session.findById(
            oldPayload.sessionId
        ).select("+refreshTokenHash");

        const oldSessionId = oldSession._id.toString();

        const result = await refreshSession(oldRefreshToken);

        assert.ok(result.accessToken);
        assert.ok(result.refreshToken);

        assert.notEqual(
            result.refreshToken,
            oldRefreshToken
        );

        assert.equal(result.user.id, user._id.toString());

        const newAccessPayload = verifyAccessToken(
            result.accessToken
        );

        const newRefreshPayload = verifyRefreshToken(
            result.refreshToken
        );

        assert.equal(
            newAccessPayload.sessionId,
            oldSessionId
        );

        assert.equal(
            newRefreshPayload.sessionId,
            oldSessionId
        );

        const updatedSession = await Session.findById(
            oldSessionId
        )
            .select("+refreshTokenHash")
            .lean();

        assert.equal(updatedSession.isActive, true);

        assert.equal(
            updatedSession.refreshTokenHash,
            hashRefreshToken(result.refreshToken)
        );

        assert.notEqual(
            updatedSession.refreshTokenHash,
            hashRefreshToken(oldRefreshToken)
        );

        assert.ok(updatedSession.lastUsedAt);
    }
);


test(
    "rejects refresh when no refresh token is provided",
    async () => {
        await assertAuthError(
            refreshSession(null),
            ERROR_CODES.INVALID_REFRESH_TOKEN,
            HTTP_STATUS.UNAUTHORIZED
        );

        await assertAuthError(
            refreshSession(""),
            ERROR_CODES.INVALID_REFRESH_TOKEN,
            HTTP_STATUS.UNAUTHORIZED
        );
    }
);


test(
    "rejects an invalid refresh token",
    async () => {
        await assertAuthError(
            refreshSession("invalid.refresh.token"),
            ERROR_CODES.INVALID_REFRESH_TOKEN,
            HTTP_STATUS.UNAUTHORIZED
        );
    }
);


test(
    "rejects an expired refresh token",
    async () => {
        const expiredToken = jwt.sign(
            {
                sessionId: new mongoose.Types.ObjectId().toString()
            },
            env.auth.refreshToken.secret,
            {
                subject: user._id.toString(),
                expiresIn: "-1s",
                issuer: env.app.name,
                audience: "ascendra-client"
            }
        );

        await assertAuthError(
            refreshSession(expiredToken),
            ERROR_CODES.REFRESH_TOKEN_EXPIRED,
            HTTP_STATUS.UNAUTHORIZED
        );
    }
);


test(
    "rejects refresh when the referenced session does not exist",
    async () => {
        const refreshToken = generateRefreshToken({
            userId: user._id.toString(),
            sessionId: new mongoose.Types.ObjectId().toString()
        });

        await assertAuthError(
            refreshSession(refreshToken),
            ERROR_CODES.SESSION_EXPIRED,
            HTTP_STATUS.UNAUTHORIZED
        );
    }
);


test(
    "rejects refresh when the session has already been revoked",
    async () => {
        const { refreshToken } = await createTestSession(
            user._id,
            {
                isActive: false,
                revokedAt: new Date()
            }
        );

        await assertAuthError(
            refreshSession(refreshToken),
            ERROR_CODES.SESSION_EXPIRED,
            HTTP_STATUS.UNAUTHORIZED
        );
    }
);


test(
    "rejects refresh when the session has expired",
    async () => {
        const { refreshToken } = await createTestSession(
            user._id,
            {
                expiresAt: new Date(Date.now() - 1000)
            }
        );

        await assertAuthError(
            refreshSession(refreshToken),
            ERROR_CODES.SESSION_EXPIRED,
            HTTP_STATUS.UNAUTHORIZED
        );
    }
);


test(
    "rejects refresh when the stored refresh token hash does not match",
    async () => {
        const refreshToken = generateRefreshToken({
            userId: user._id.toString(),
            sessionId: new mongoose.Types.ObjectId().toString()
        });

        const payload = verifyRefreshToken(refreshToken);

        await Session.create({
            _id: payload.sessionId,
            user: user._id,
            refreshTokenHash: hashRefreshToken("different-refresh-token"),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        });

        await assertAuthError(
            refreshSession(refreshToken),
            ERROR_CODES.INVALID_REFRESH_TOKEN,
            HTTP_STATUS.UNAUTHORIZED
        );
    }
);


test("rejects refresh when the associated user is suspended", async () => {
    const user = await createTestUser({
        email: `suspended-${new mongoose.Types.ObjectId()}@example.com`
    });

    const { refreshToken } = await createTestSession(user._id, {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    // Confirm that the JWT itself has not expired.
    const payload = verifyRefreshToken(refreshToken);

    assert.ok(payload.exp * 1000 > Date.now());

    // Confirm that the stored session has not expired.
    const session = await Session.findOne({ user: user._id });

    assert.ok(session);
    assert.ok(session.expiresAt > new Date());

    user.status = "suspended";
    await user.save();

    await assertAuthError(
        refreshSession(refreshToken),
        ERROR_CODES.ACCOUNT_SUSPENDED,
        HTTP_STATUS.FORBIDDEN
    );
});


/* -------------------------------------------------------------------------- */
/* Logout                                                                     */
/* -------------------------------------------------------------------------- */

test(
    "revokes the session associated with a valid refresh token",
    async () => {
        const loginResult = await login({
            email: user.email,
            password: "OriginalPassword123"
        });

        const payload = verifyRefreshToken(
            loginResult.refreshToken
        );

        await logout(loginResult.refreshToken);

        const updatedSession = await Session.findById(
            payload.sessionId
        ).lean();

        assert.equal(updatedSession.isActive, false);
        assert.equal(updatedSession.revokedReason, "logout");
        assert.ok(updatedSession.revokedAt);
    }
);


test(
    "does nothing when logout receives no refresh token",
    async () => {
        const { session } = await createTestSession(user._id);

        await assert.doesNotReject(logout(null));
        await assert.doesNotReject(logout(""));

        const unchangedSession = await Session.findById(
            session._id
        ).lean();

        assert.equal(unchangedSession.isActive, true);
        assert.equal(unchangedSession.revokedAt, null);
    }
);


test(
    "does nothing when logout receives an invalid refresh token",
    async () => {
        const { session } = await createTestSession(user._id);

        await assert.doesNotReject(
            logout("invalid.refresh.token")
        );

        const unchangedSession = await Session.findById(
            session._id
        ).lean();

        assert.equal(unchangedSession.isActive, true);
    }
);


test(
    "allows an expired but correctly signed refresh token to revoke its session",
    async () => {
        const sessionId = new mongoose.Types.ObjectId();

        const expiredToken = jwt.sign(
            { sessionId: sessionId.toString() },
            env.auth.refreshToken.secret,
            {
                subject: user._id.toString(),
                expiresIn: "-1s",
                issuer: env.app.name,
                audience: "ascendra-client"
            }
        );

        await Session.create({
            _id: sessionId,
            user: user._id,
            refreshTokenHash: hashRefreshToken(expiredToken),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        });

        await assert.doesNotReject(
            logout(expiredToken)
        );

        const updatedSession = await Session.findById(
            sessionId
        ).lean();

        assert.equal(updatedSession.isActive, false);
        assert.equal(updatedSession.revokedReason, "logout");
        assert.ok(updatedSession.revokedAt);
    }
);


test(
    "does not revoke a session when the refresh token hash does not match",
    async () => {
        const refreshToken = generateRefreshToken({
            userId: user._id.toString(),
            sessionId: new mongoose.Types.ObjectId().toString()
        });

        const payload = verifyRefreshToken(refreshToken);

        const { session } = await createTestSession(
            user._id,
            {
                refreshTokenHash: hashRefreshToken("another-token"),
                sessionData: {
                    _id: payload.sessionId
                }
            }
        );

        await logout(refreshToken);

        const unchangedSession = await Session.findById(
            session._id
        ).lean();

        assert.equal(unchangedSession.isActive, true);
        assert.equal(unchangedSession.revokedAt, null);
    }
);


/* -------------------------------------------------------------------------- */
/* Logout all                                                                 */
/* -------------------------------------------------------------------------- */

test(
    "revokes every active session belonging to a user",
    async () => {
        const first = await createTestSession(user._id);
        const second = await createTestSession(user._id);

        const inactive = await createTestSession(
            user._id,
            {
                isActive: false,
                revokedAt: new Date()
            }
        );

        const modifiedCount = await logoutAll(user._id);

        assert.equal(modifiedCount, 2);

        const firstUpdated = await Session.findById(
            first.session._id
        ).lean();

        const secondUpdated = await Session.findById(
            second.session._id
        ).lean();

        const inactiveUnchanged = await Session.findById(
            inactive.session._id
        ).lean();

        for (const session of [firstUpdated, secondUpdated]) {
            assert.equal(session.isActive, false);
            assert.equal(session.revokedReason, "logout_all");
            assert.ok(session.revokedAt);
        }

        assert.equal(inactiveUnchanged.isActive, false);
        assert.equal(inactiveUnchanged.revokedReason, null);
    }
);


test(
    "returns zero when logoutAll has no active sessions",
    async () => {
        const modifiedCount = await logoutAll(
            new mongoose.Types.ObjectId()
        );

        assert.equal(modifiedCount, 0);
    }
);


/* -------------------------------------------------------------------------- */
/* Change password                                                            */
/* -------------------------------------------------------------------------- */

test(
    "changes the password and revokes all active sessions",
    async () => {
        const first = await createTestSession(user._id);
        const second = await createTestSession(user._id);

        const result = await changePassword(
            user._id,
            {
                currentPassword: "OriginalPassword123",
                newPassword: "UpdatedPassword123"
            }
        );

        assert.equal(result, undefined);

        const updatedUser = await User.findById(user._id)
            .select("+passwordHash")
            .lean();

        assert.equal(
            await comparePassword(
                "UpdatedPassword123",
                updatedUser.passwordHash
            ),
            true
        );

        assert.equal(
            await comparePassword(
                "OriginalPassword123",
                updatedUser.passwordHash
            ),
            false
        );

        assert.ok(updatedUser.passwordChangedAt);

        for (const originalSession of [
            first.session,
            second.session
        ]) {
            const updatedSession = await Session.findById(
                originalSession._id
            ).lean();

            assert.equal(updatedSession.isActive, false);
            assert.equal(
                updatedSession.revokedReason,
                "password_changed"
            );
            assert.ok(updatedSession.revokedAt);
        }
    }
);


test(
    "rejects changing the password to the current password",
    async () => {
        await assertAuthError(
            changePassword(
                user._id,
                {
                    currentPassword: "OriginalPassword123",
                    newPassword: "OriginalPassword123"
                }
            ),
            ERROR_CODES.PASSWORD_MISMATCH,
            HTTP_STATUS.BAD_REQUEST
        );
    }
);


test(
    "rejects password change when the current password is incorrect",
    async () => {
        const { session } = await createTestSession(user._id);

        await assertAuthError(
            changePassword(
                user._id,
                {
                    currentPassword: "WrongPassword123",
                    newPassword: "UpdatedPassword123"
                }
            ),
            ERROR_CODES.INVALID_CREDENTIALS,
            HTTP_STATUS.UNAUTHORIZED
        );

        const unchangedUser = await User.findById(user._id)
            .select("+passwordHash")
            .lean();

        assert.equal(
            await comparePassword(
                "OriginalPassword123",
                unchangedUser.passwordHash
            ),
            true
        );

        const unchangedSession = await Session.findById(
            session._id
        ).lean();

        assert.equal(unchangedSession.isActive, true);
    }
);


test(
    "rejects password change when the user does not exist",
    async () => {
        await assertAuthError(
            changePassword(
                new mongoose.Types.ObjectId(),
                {
                    currentPassword: "OriginalPassword123",
                    newPassword: "UpdatedPassword123"
                }
            ),
            ERROR_CODES.USER_NOT_FOUND,
            HTTP_STATUS.NOT_FOUND
        );
    }
);


test(
    "rejects password change for a suspended account",
    async () => {
        user.status = "suspended";
        await user.save();

        await assertAuthError(
            changePassword(
                user._id,
                {
                    currentPassword: "OriginalPassword123",
                    newPassword: "UpdatedPassword123"
                }
            ),
            ERROR_CODES.ACCOUNT_SUSPENDED,
            HTTP_STATUS.FORBIDDEN
        );
    }
);


test(
    "rejects password change when password authentication is not configured",
    async () => {
        const passwordlessUser = await User.create({
            firstName: "Passwordless",
            lastName: "User",
            email: "passwordless@example.com"
        });

        await assertAuthError(
            changePassword(
                passwordlessUser._id,
                {
                    currentPassword: "OriginalPassword123",
                    newPassword: "UpdatedPassword123"
                }
            ),
            ERROR_CODES.INVALID_CREDENTIALS,
            HTTP_STATUS.BAD_REQUEST
        );
    }
);


/* -------------------------------------------------------------------------- */
/* Current user                                                               */
/* -------------------------------------------------------------------------- */

test(
    "returns the authenticated user's public profile",
    async () => {
        const result = await getCurrentUser(user._id);

        assert.equal(result.id, user._id.toString());
        assert.equal(result.firstName, user.firstName);
        assert.equal(result.lastName, user.lastName);
        assert.equal(result.email, user.email);
        assert.equal(result.status, "active");
        assert.equal(result.platformRole, "user");
        assert.equal(result.phone, null);
        assert.equal(result.profileImage, null);

        assert.equal(
            Object.hasOwn(result, "passwordHash"),
            false
        );
    }
);


test(
    "returns profile image and phone information when available",
    async () => {
        user.phone = "9876543210";
        user.profileImage = {
            originalName: "profile.png",
            storageProvider: "cloudinary",
            storageKey: "users/profile.png",
            mimeType: "image/png",
            size: 1024,
            uploadedAt: new Date()
        };

        await user.save();

        const result = await getCurrentUser(user._id);

        assert.equal(result.phone, "9876543210");
        assert.equal(
            result.profileImage.originalName,
            "profile.png"
        );
        assert.equal(
            result.profileImage.storageProvider,
            "cloudinary"
        );
    }
);


test(
    "rejects retrieving a user profile when the user does not exist",
    async () => {
        await assertAuthError(
            getCurrentUser(new mongoose.Types.ObjectId()),
            ERROR_CODES.USER_NOT_FOUND,
            HTTP_STATUS.NOT_FOUND
        );
    }
);


test(
    "rejects retrieving a suspended user's profile",
    async () => {
        user.status = "suspended";
        await user.save();

        await assertAuthError(
            getCurrentUser(user._id),
            ERROR_CODES.ACCOUNT_SUSPENDED,
            HTTP_STATUS.FORBIDDEN
        );
    }
);


test(
    "rejects retrieving a deactivated user's profile",
    async () => {
        user.status = "deactivated";
        await user.save();

        await assertAuthError(
            getCurrentUser(user._id),
            ERROR_CODES.ACCOUNT_SUSPENDED,
            HTTP_STATUS.FORBIDDEN
        );
    }
);
