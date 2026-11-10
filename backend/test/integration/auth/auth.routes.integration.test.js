import test, {
    before,
    after,
    beforeEach
} from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-auth-routes";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-auth-routes";
process.env.SMTP_HOST = "smtp.example.com";
process.env.SMTP_PORT = "587";
process.env.SMTP_SECURE = "false";
process.env.SMTP_USER = "test-user";
process.env.SMTP_PASSWORD = "test-password";
process.env.EMAIL_FROM = "Ascendra <no-reply@example.com>";

const [{ default: app }, database, { default: Session }] =
    await Promise.all([
        import("../../../src/app.js"),
        import("../../helpers/database.js"),
        import("../../../src/modules/sessions/session.model.js")
    ]);

let server;
let baseUrl;

before(async () => {
    await database.startTestDatabase();
    server = app.listen(0);

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }

    await database.stopTestDatabase();
});

beforeEach(async () => {
    await database.clearTestDatabase();
});

test("registers, authenticates, reads the protected profile and logs out over HTTP", async () => {
    const registrationResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            firstName: "Integration",
            lastName: "Tester",
            email: "integration.tester@example.com",
            password: "SecurePassword123",
            phone: "9876543210"
        })
    });
    const registrationBody = await registrationResponse.json();

    assert.equal(registrationResponse.status, 201);
    assert.equal(
        registrationBody.data.user.email,
        "integration.tester@example.com"
    );
    assert.equal(
        Object.hasOwn(registrationBody.data.user, "passwordHash"),
        false
    );

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "INTEGRATION.TESTER@example.com",
            password: "SecurePassword123"
        })
    });
    const loginBody = await loginResponse.json();
    const setCookie = loginResponse.headers.get("set-cookie");

    assert.equal(loginResponse.status, 200);
    assert.equal(loginBody.data.user.email, "integration.tester@example.com");
    assert.ok(loginBody.data.accessToken);
    assert.match(setCookie, /^refreshToken=[^;]+;/);
    assert.equal(await Session.countDocuments({ isActive: true }), 1);

    const profileResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: {
            Authorization: `Bearer ${loginBody.data.accessToken}`
        }
    });
    const profileBody = await profileResponse.json();

    assert.equal(profileResponse.status, 200);
    assert.equal(
        profileBody.data.user.email,
        "integration.tester@example.com"
    );

    const logoutResponse = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
            Cookie: setCookie.split(";")[0]
        }
    });
    const logoutBody = await logoutResponse.json();

    assert.equal(logoutResponse.status, 200);
    assert.equal(logoutBody.message, "Logout successful.");
    assert.equal(await Session.countDocuments({ isActive: true }), 0);
    assert.equal(await Session.countDocuments({ revokedReason: "logout" }), 1);
});

test("validates authentication requests and rejects invalid credentials", async () => {
    const invalidRegistration = await fetch(
        `${baseUrl}/api/v1/auth/register`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                firstName: "X",
                lastName: "",
                email: "not-an-email",
                password: "short"
            })
        }
    );
    const invalidRegistrationBody = await invalidRegistration.json();

    assert.equal(invalidRegistration.status, 422);
    assert.equal(invalidRegistrationBody.error.code, "VALIDATION_ERROR");
    assert.ok(invalidRegistrationBody.error.details.length > 0);

    const invalidLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "nobody@example.com",
            password: "NoSuchPassword"
        })
    });
    const invalidLoginBody = await invalidLogin.json();

    assert.equal(invalidLogin.status, 401);
    assert.equal(invalidLoginBody.error.code, "INVALID_CREDENTIALS");
});

test("requests and consumes a password-reset token through the HTTP API", async (t) => {
    const registrationResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            firstName: "Reset",
            lastName: "Tester",
            email: "reset.tester@example.com",
            password: "OriginalPassword123"
        })
    });
    assert.equal(registrationResponse.status, 201);

    let capturedMail;
    t.mock.method(nodemailer, "createTransport", () => ({
        sendMail: async (message) => {
            capturedMail = message;
            return { messageId: "password-reset-test" };
        }
    }));

    const forgotResponse = await fetch(
        `${baseUrl}/api/v1/auth/forgot-password`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "RESET.TESTER@example.com"
            })
        }
    );
    const forgotBody = await forgotResponse.json();

    assert.equal(forgotResponse.status, 200);
    assert.match(forgotBody.message, /If an active account matches/);
    assert.equal(capturedMail.to, "reset.tester@example.com");

    const resetToken = capturedMail.text.match(
        /https?:\/\/\S+\/reset-password\?token=([a-f0-9]{64})/
    )?.[1];
    assert.ok(resetToken);

    const resetResponse = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            token: resetToken,
            newPassword: "ReplacementPassword123"
        })
    });
    const resetBody = await resetResponse.json();

    assert.equal(resetResponse.status, 200);
    assert.equal(
        resetBody.message,
        "Password reset successfully. Please log in again."
    );
    assert.equal(await Session.countDocuments({ isActive: true }), 0);

    const oldPasswordLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "reset.tester@example.com",
            password: "OriginalPassword123"
        })
    });
    const newPasswordLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "reset.tester@example.com",
            password: "ReplacementPassword123"
        })
    });

    assert.equal(oldPasswordLogin.status, 401);
    assert.equal(newPasswordLogin.status, 200);
});

test("revokes all sessions and changes the password through protected routes", async () => {
    await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            firstName: "Session",
            lastName: "Tester",
            email: "session.tester@example.com",
            password: "OriginalPassword123"
        })
    });

    const login = async () => {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "session.tester@example.com",
                password: "OriginalPassword123"
            })
        });
        return {
            response,
            body: await response.json()
        };
    };

    const firstSession = await login();
    const secondSession = await login();

    assert.equal(firstSession.response.status, 200);
    assert.equal(secondSession.response.status, 200);
    assert.equal(await Session.countDocuments({ isActive: true }), 2);

    const logoutAllResponse = await fetch(
        `${baseUrl}/api/v1/auth/logout-all`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${firstSession.body.data.accessToken}`
            }
        }
    );
    const logoutAllBody = await logoutAllResponse.json();

    assert.equal(logoutAllResponse.status, 200);
    assert.equal(logoutAllBody.data.revokedSessions, 2);
    assert.equal(await Session.countDocuments({ isActive: true }), 0);

    const currentSession = await login();
    const changePasswordResponse = await fetch(
        `${baseUrl}/api/v1/auth/change-password`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentSession.body.data.accessToken}`
            },
            body: JSON.stringify({
                currentPassword: "OriginalPassword123",
                newPassword: "ChangedPassword123"
            })
        }
    );
    const changePasswordBody = await changePasswordResponse.json();

    assert.equal(changePasswordResponse.status, 200);
    assert.equal(
        changePasswordBody.message,
        "Password changed successfully. Please log in again."
    );
    assert.equal(await Session.countDocuments({ isActive: true }), 0);

    const oldPasswordLogin = await login();
    assert.equal(oldPasswordLogin.response.status, 401);

    const changedPasswordLogin = await fetch(
        `${baseUrl}/api/v1/auth/login`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "session.tester@example.com",
                password: "ChangedPassword123"
            })
        }
    );
    assert.equal(changedPasswordLogin.status, 200);
});
