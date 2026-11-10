import test from "node:test";
import assert from "node:assert/strict";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-auth-middleware";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-auth-middleware";

const [
    { authenticate },
    { generateAccessToken },
    User,
    Session
] = await Promise.all([
    import("../../../../src/modules/auth/auth.middleware.js"),
    import("../../../../src/modules/auth/auth.utils.js"),
    import("../../../../src/modules/auth/user.model.js").then(
        ({ default: UserModel }) => UserModel
    ),
    import("../../../../src/modules/sessions/session.model.js").then(
        ({ default: SessionModel }) => SessionModel
    )
]);

const createQuery = (result) => ({
    select() {
        return this;
    },
    lean() {
        return Promise.resolve(result);
    }
});

const createRequest = (token) => ({
    headers: token
        ? { authorization: `Bearer ${token}` }
        : {}
});

const runAuthenticate = (request) =>
    new Promise((resolve) => {
        authenticate(request, {}, (error) => resolve(error ?? null));
    });

const createToken = () => generateAccessToken({
    userId: "user-1",
    sessionId: "session-1"
});

const mockActiveSession = (t, session = { _id: "session-1" }) => {
    let capturedFilter;

    t.mock.method(Session, "findOne", (filter) => {
        capturedFilter = filter;
        return createQuery(session);
    });

    return () => capturedFilter;
};

const mockUser = (t, user) => {
    t.mock.method(User, "findById", () => createQuery(user));
};

test("requires a bearer access token", async () => {
    const error = await runAuthenticate(createRequest());

    assert.equal(error.statusCode, 401);
    assert.equal(error.code, "AUTH_REQUIRED");
});

test("rejects malformed or invalid access tokens", async () => {
    const error = await runAuthenticate(createRequest("invalid.token"));

    assert.equal(error.statusCode, 401);
    assert.equal(error.code, "INVALID_ACCESS_TOKEN");
});

test("checks that the token session is active, unrevoked and unexpired", async (t) => {
    const captureFilter = mockActiveSession(t, null);
    const error = await runAuthenticate(createRequest(createToken()));
    const filter = captureFilter();

    assert.equal(error.statusCode, 401);
    assert.equal(error.code, "SESSION_EXPIRED");
    assert.equal(filter._id, "session-1");
    assert.equal(filter.user, "user-1");
    assert.equal(filter.isActive, true);
    assert.equal(filter.revokedAt, null);
    assert.ok(filter.expiresAt.$gt instanceof Date);
});

test("rejects a token when its user no longer exists", async (t) => {
    mockActiveSession(t);
    mockUser(t, null);

    const error = await runAuthenticate(createRequest(createToken()));

    assert.equal(error.statusCode, 401);
    assert.equal(error.code, "USER_NOT_FOUND");
});

test("rejects suspended user accounts", async (t) => {
    mockActiveSession(t);
    mockUser(t, {
        _id: "user-1",
        status: "suspended"
    });

    const error = await runAuthenticate(createRequest(createToken()));

    assert.equal(error.statusCode, 403);
    assert.equal(error.code, "ACCOUNT_SUSPENDED");
});

test("rejects access tokens issued before a password change", async (t) => {
    mockActiveSession(t);
    mockUser(t, {
        _id: "user-1",
        status: "active",
        passwordChangedAt: new Date(Date.now() + 60_000)
    });

    const error = await runAuthenticate(createRequest(createToken()));

    assert.equal(error.statusCode, 401);
    assert.equal(error.code, "SESSION_REVOKED");
});

test("attaches authenticated user and session details to the request", async (t) => {
    mockActiveSession(t);
    mockUser(t, {
        _id: { toString: () => "user-1" },
        status: "active",
        platformRole: "platform_admin",
        passwordChangedAt: null
    });
    const request = createRequest(createToken());
    const error = await runAuthenticate(request);

    assert.equal(error, null);
    assert.deepEqual(request.user, {
        userId: "user-1",
        sessionId: "session-1",
        platformRole: "platform_admin",
        role: undefined
    });
});
