import test, {
    before,
    after,
    beforeEach,
    mock
} from "node:test";

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import nodemailer from "nodemailer";

import {
    startTestDatabase,
    clearTestDatabase,
    stopTestDatabase
} from "../../helpers/database.js";

import User from "../../../src/modules/auth/user.model.js";
import PasswordResetToken from "../../../src/modules/auth/passwordResetToken.model.js";
import Session from "../../../src/modules/sessions/session.model.js";
import AppError from "../../../src/core/errors/AppError.js";
import { ERROR_CODES } from "../../../src/core/constants/index.js";
import {
    comparePassword,
    hashPassword,
    hashRefreshToken
} from "../../../src/modules/auth/auth.utils.js";
import {
    requestPasswordReset,
    resetPassword
} from "../../../src/modules/auth/auth.service.js";

let user;
let resetToken;
let session;

before(async () => {
    await startTestDatabase();
});

after(async () => {
    await stopTestDatabase();
});

beforeEach(async () => {
    await clearTestDatabase();

    user = await User.create({
        firstName: "Test",
        lastName: "User",
        email: "test.user@example.com",
        passwordHash: await hashPassword("OriginalPassword123")
    });

    resetToken = "a".repeat(64);

    await PasswordResetToken.create({
        user: user._id,
        tokenHash: createHash("sha256")
            .update(resetToken)
            .digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    session = await Session.create({
        user: user._id,
        refreshTokenHash: hashRefreshToken("test-refresh-token"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });
});

test(
    "resets the password, consumes the token, and revokes existing sessions",
    async () => {
        await resetPassword({
            token: resetToken,
            newPassword: "UpdatedPassword123"
        });

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
        assert.ok(updatedUser.passwordChangedAt);

        const updatedSession = await Session.findById(session._id).lean();
        assert.equal(updatedSession.isActive, false);
        assert.equal(updatedSession.revokedReason, "password_changed");
        assert.ok(updatedSession.revokedAt);

        assert.equal(
            await PasswordResetToken.countDocuments({ user: user._id }),
            0
        );

        await assert.rejects(
            resetPassword({
                token: resetToken,
                newPassword: "AnotherPassword123"
            }),
            (error) => {
                assert.equal(
                    error.code,
                    ERROR_CODES.INVALID_PASSWORD_RESET_TOKEN
                );
                return true;
            }
        );
    }
);

test(
    "rejects expired or already-consumed password-reset tokens",
    async () => {
        await PasswordResetToken.updateOne(
            { user: user._id },
            { $set: { expiresAt: new Date(Date.now() - 1000) } }
        );

        await assert.rejects(
            resetPassword({
                token: resetToken,
                newPassword: "UpdatedPassword123"
            }),
            (error) => {
                assert.ok(error instanceof AppError);
                assert.equal(
                    error.code,
                    ERROR_CODES.INVALID_PASSWORD_RESET_TOKEN
                );
                return true;
            }
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

        const unchangedSession = await Session.findById(session._id).lean();
        assert.equal(unchangedSession.isActive, true);
    }
);

test(
    "does not create a reset token for an unknown account",
    async () => {
        await PasswordResetToken.deleteMany({ user: user._id });

        await assert.doesNotReject(
            requestPasswordReset("missing.user@example.com")
        );

        assert.equal(await PasswordResetToken.countDocuments(), 0);
    }
);

test(
    "emails a single-use reset link and stores only its token hash",
    async () => {
        const messages = [];
        const transportMock = mock.method(
            nodemailer,
            "createTransport",
            () => ({
                sendMail: async (message) => {
                    messages.push(message);
                    return { messageId: "test-message" };
                }
            })
        );

        try {
            await requestPasswordReset(user.email);

            assert.equal(messages.length, 1);
            assert.equal(messages[0].to, user.email);
            assert.match(messages[0].subject, /reset your Ascendra password/i);

            const resetUrl = new URL(
                messages[0].text.match(/https?:\/\/\S+/)[0]
            );
            const rawToken = resetUrl.searchParams.get("token");

            assert.match(rawToken, /^[a-f0-9]{64}$/);

            const savedToken = await PasswordResetToken.findOne({
                user: user._id
            })
                .select("+tokenHash")
                .lean();

            assert.equal(
                savedToken.tokenHash,
                createHash("sha256").update(rawToken).digest("hex")
            );
            assert.notEqual(savedToken.tokenHash, rawToken);
            assert.ok(savedToken.expiresAt > new Date());
        } finally {
            transportMock.mock.restore();
        }
    }
);
