import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Session from "../../../../src/modules/sessions/session.model.js";

const createSession = (overrides = {}) => new Session({
    user: new mongoose.Types.ObjectId(),
    refreshTokenHash: "a".repeat(64),
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides
});

test("validates a session with a hashed refresh token and expiry", async () => {
    const session = createSession();

    await assert.doesNotReject(session.validate());
    assert.equal(Session.schema.path("refreshTokenHash").options.select, false);
    assert.equal(session.isActive, true);
    assert.equal(session.revokedAt, null);
});

test("requires a user, refresh-token hash and expiration date", async () => {
    const session = new Session({});
    const error = await session.validate().then(
        () => assert.fail("Expected missing required session fields"),
        (validationError) => validationError
    );

    assert.ok(error.errors.user);
    assert.ok(error.errors.refreshTokenHash);
    assert.ok(error.errors.expiresAt);
});

test("accepts only supported session revocation reasons", async () => {
    const session = createSession({ revokedReason: "unsupported" });
    const error = await session.validate().then(
        () => assert.fail("Expected an invalid revocation reason"),
        (validationError) => validationError
    );

    assert.ok(error.errors.revokedReason);
});

test("creates TTL and active-session lookup indexes", () => {
    const indexes = Session.schema.indexes();
    const expiryIndex = indexes.find(
        ([keys]) => keys.expiresAt === 1
    );
    const activeSessionIndex = indexes.find(
        ([keys]) => keys.user === 1 && keys.isActive === 1
    );

    assert.deepEqual(expiryIndex[1], {
        expireAfterSeconds: 0,
        name: "session_expiry_ttl"
    });
    assert.equal(activeSessionIndex[1].name, "session_user_active_expiry");
});
