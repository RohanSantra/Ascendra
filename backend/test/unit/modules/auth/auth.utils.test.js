import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-auth-utils";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-auth-utils";

const {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    hashRefreshToken,
    hashPassword,
    comparePassword,
    getRefreshCookieOptions,
    getRefreshCookieName
} = await import("../../../../src/modules/auth/auth.utils.js");
const { env } = await import("../../../../src/config/index.js");

test("generates and verifies an access token with its user and session claims", () => {
    const token = generateAccessToken({
        userId: "user-1",
        sessionId: "session-1"
    });
    const payload = verifyAccessToken(token);

    assert.equal(payload.sub, "user-1");
    assert.equal(payload.sessionId, "session-1");
    assert.equal(payload.iss, env.app.name);
    assert.equal(payload.aud, "ascendra-client");
});

test("generates unique refresh tokens and verifies their session claims", () => {
    const tokenOptions = {
        userId: "user-1",
        sessionId: "session-1"
    };
    const firstToken = generateRefreshToken(tokenOptions);
    const secondToken = generateRefreshToken(tokenOptions);

    assert.notEqual(firstToken, secondToken);
    assert.equal(verifyRefreshToken(firstToken).sub, "user-1");
    assert.equal(verifyRefreshToken(firstToken).sessionId, "session-1");
    assert.ok(verifyRefreshToken(firstToken).jti);
});

test("rejects access and refresh tokens signed with an invalid signature", () => {
    assert.throws(() => verifyAccessToken("invalid.token.value"));
    assert.throws(() => verifyRefreshToken("invalid.token.value"));
});

test("hashes refresh tokens deterministically with SHA-256", () => {
    const firstHash = hashRefreshToken("refresh-token");

    assert.equal(firstHash, hashRefreshToken("refresh-token"));
    assert.notEqual(firstHash, hashRefreshToken("another-token"));
    assert.match(firstHash, /^[a-f0-9]{64}$/);
});

test("hashes passwords and compares matching and non-matching values", async () => {
    const passwordHash = await hashPassword("Correct-Horse-Battery");

    assert.notEqual(passwordHash, "Correct-Horse-Battery");
    assert.equal(
        await comparePassword("Correct-Horse-Battery", passwordHash),
        true
    );
    assert.equal(await comparePassword("wrong-password", passwordHash), false);
});

test("returns secure refresh cookie settings from environment configuration", () => {
    const options = getRefreshCookieOptions();

    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, env.nodeEnv === "production");
    assert.equal(options.sameSite, "lax");
    assert.equal(options.path, "/api/v1/auth");
    assert.equal(options.maxAge, env.auth.refreshToken.cookieMaxAge);
    assert.equal(getRefreshCookieName(), env.auth.refreshToken.cookieName);
});
