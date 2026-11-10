import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";

// Ensure the email configuration is available before importing the service.
process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";

process.env.SMTP_HOST = "smtp.example.com";
process.env.SMTP_PORT = "587";
process.env.SMTP_SECURE = "false";
process.env.SMTP_USER = "test-user";
process.env.SMTP_PASSWORD = "test-password";
process.env.EMAIL_FROM = "Ascendra <no-reply@example.com>";

const {
    sendOrganizationInvitationEmail,
    sendPasswordResetEmail
} = await import("../../../../src/core/utils/email.service.js");


const validInvitation = {
    to: "trainer@example.com",
    organizationName: "Ascendra Academy",
    role: "trainer",
    invitationUrl: "https://example.com/invitations/accept?token=secret",
    expiresAt: new Date("2027-01-15T12:00:00.000Z")
};


const validPasswordReset = {
    to: "user@example.com",
    firstName: "Alex",
    resetUrl: "https://example.com/reset-password?token=secret",
    expiresAt: new Date("2027-01-15T12:00:00.000Z")
};


const mockTransport = (t, sendMailImplementation) => {
    const transport = {
        sendMail: sendMailImplementation
    };

    let capturedOptions;

    t.mock.method(
        nodemailer,
        "createTransport",
        (options) => {
            capturedOptions = options;
            return transport;
        }
    );

    return {
        transport,
        getOptions: () => capturedOptions
    };
};


test("sends an organisation invitation email", async (t) => {
    let capturedMail;

    const deliveryInfo = {
        messageId: "invitation-message-1",
        accepted: ["trainer@example.com"]
    };

    const mock = mockTransport(t, async (options) => {
        capturedMail = options;
        return deliveryInfo;
    });

    const result = await sendOrganizationInvitationEmail(
        validInvitation
    );

    assert.equal(result, deliveryInfo);

    assert.deepEqual(mock.getOptions(), {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: {
            user: "test-user",
            pass: "test-password"
        }
    });

    assert.equal(capturedMail.from, "Ascendra <no-reply@example.com>");
    assert.equal(capturedMail.to, validInvitation.to);
    assert.match(capturedMail.subject, /Ascendra Academy/);
    assert.match(capturedMail.text, /Invited role: trainer/);
    assert.match(capturedMail.text, /invitations\/accept/);
    assert.match(capturedMail.html, /Accept Invitation/);
    assert.match(capturedMail.html, /Ascendra Academy/);
});


test("normalizes the organisation invitation role", async (t) => {
    let capturedMail;

    mockTransport(t, async (options) => {
        capturedMail = options;
        return { messageId: "normalized-role" };
    });

    await sendOrganizationInvitationEmail({
        ...validInvitation,
        role: "TRAINER"
    });

    assert.match(capturedMail.subject, /Ascendra Academy/);
    assert.match(capturedMail.text, /Invited role: trainer/);
});


test("escapes user-controlled organisation name in invitation HTML", async (t) => {
    let capturedMail;

    mockTransport(t, async (options) => {
        capturedMail = options;
        return { messageId: "escaped-invitation" };
    });

    await sendOrganizationInvitationEmail({
        ...validInvitation,
        organizationName: '<img src=x onerror="alert(1)"> & Academy'
    });

    assert.ok(
        capturedMail.html.includes(
            "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Academy"
        )
    );

    assert.equal(
        capturedMail.html.includes('<img src=x onerror="alert(1)">'),
        false
    );
});


test("rejects missing organisation invitation information", async () => {
    await assert.rejects(
        () => sendOrganizationInvitationEmail({
            ...validInvitation,
            to: ""
        }),
        {
            message: "Required organisation invitation email information is missing."
        }
    );
});


test("rejects unsupported organisation invitation roles", async () => {
    await assert.rejects(
        () => sendOrganizationInvitationEmail({
            ...validInvitation,
            role: "admin"
        }),
        {
            message: "Invalid organisation invitation role."
        }
    );
});


test("rejects malformed organisation invitation URLs", async () => {
    await assert.rejects(
        () => sendOrganizationInvitationEmail({
            ...validInvitation,
            invitationUrl: "not-a-valid-url"
        }),
        {
            message: "Invalid organisation invitation URL."
        }
    );
});


test("rejects non-HTTP organisation invitation URLs", async () => {
    await assert.rejects(
        () => sendOrganizationInvitationEmail({
            ...validInvitation,
            invitationUrl: "javascript:alert(1)"
        }),
        {
            message: "Invitation URL must use HTTP or HTTPS."
        }
    );
});


test("rejects invalid organisation invitation expiry dates", async () => {
    await assert.rejects(
        () => sendOrganizationInvitationEmail({
            ...validInvitation,
            expiresAt: "not-a-date"
        }),
        {
            message: "Invalid invitation expiry date."
        }
    );
});


test("propagates organisation invitation delivery errors", async (t) => {
    const deliveryError = new Error("SMTP delivery failed");

    mockTransport(t, async () => {
        throw deliveryError;
    });

    await assert.rejects(
        () => sendOrganizationInvitationEmail(validInvitation),
        (error) => error === deliveryError
    );
});


test("sends a password-reset email", async (t) => {
    let capturedMail;

    const deliveryInfo = {
        messageId: "password-reset-1",
        accepted: ["user@example.com"]
    };

    mockTransport(t, async (options) => {
        capturedMail = options;
        return deliveryInfo;
    });

    const result = await sendPasswordResetEmail(
        validPasswordReset
    );

    assert.equal(result, deliveryInfo);
    assert.equal(capturedMail.from, "Ascendra <no-reply@example.com>");
    assert.equal(capturedMail.to, validPasswordReset.to);
    assert.equal(
        capturedMail.subject,
        "Reset your Ascendra password"
    );

    assert.match(capturedMail.text, /Hello Alex/);
    assert.match(capturedMail.text, /reset your Ascendra password/);
    assert.match(capturedMail.html, /Reset Password/);
    assert.match(capturedMail.html, /Hello Alex/);
});


test("escapes the recipient name in password-reset HTML", async (t) => {
    let capturedMail;

    mockTransport(t, async (options) => {
        capturedMail = options;
        return { messageId: "escaped-reset" };
    });

    await sendPasswordResetEmail({
        ...validPasswordReset,
        firstName: '<script>alert("x")</script>'
    });

    assert.ok(
        capturedMail.html.includes(
            "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
        )
    );

    assert.equal(
        capturedMail.html.includes(
            '<script>alert("x")</script>'
        ),
        false
    );
});


test("rejects missing password-reset information", async () => {
    await assert.rejects(
        () => sendPasswordResetEmail({
            ...validPasswordReset,
            firstName: ""
        }),
        {
            message: "Required password-reset email information is missing."
        }
    );
});


test("rejects malformed password-reset URLs", async () => {
    await assert.rejects(
        () => sendPasswordResetEmail({
            ...validPasswordReset,
            resetUrl: "not-a-valid-url"
        }),
        {
            message: "Invalid password-reset URL."
        }
    );
});


test("rejects non-HTTP password-reset URLs", async () => {
    await assert.rejects(
        () => sendPasswordResetEmail({
            ...validPasswordReset,
            resetUrl: "javascript:alert(1)"
        }),
        {
            message: "Password-reset URL must use HTTP or HTTPS."
        }
    );
});


test("rejects invalid password-reset expiry dates", async () => {
    await assert.rejects(
        () => sendPasswordResetEmail({
            ...validPasswordReset,
            expiresAt: "invalid-date"
        }),
        {
            message: "Invalid invitation expiry date."
        }
    );
});


test("propagates password-reset delivery errors", async (t) => {
    const deliveryError = new Error("SMTP unavailable");

    mockTransport(t, async () => {
        throw deliveryError;
    });

    await assert.rejects(
        () => sendPasswordResetEmail(validPasswordReset),
        (error) => error === deliveryError
    );
});