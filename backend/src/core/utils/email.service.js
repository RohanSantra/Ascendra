
import nodemailer from "nodemailer";

import { env } from "../../config/index.js";

/**
 * Email Service
 *
 * Centralised email delivery utility for the application.
 *
 * Responsibilities:
 * - Configure the SMTP transport.
 * - Send transactional emails.
 * - Provide reusable email delivery functionality.
 *
 * SMTP credentials are read from the central environment
 * configuration and must never be hardcoded here.
 */

/**
 * Creates the Nodemailer SMTP transport.
 *
 * The transport is created lazily when an email is sent,
 * rather than during application startup.
 *
 * @returns {import("nodemailer").Transporter} SMTP transporter.
 */
const createEmailTransport = () => {
    const emailConfig = env.email;

    if (
        !emailConfig?.host ||
        !emailConfig?.port ||
        !emailConfig?.from
    ) {
        throw new Error(
            "Email service is not configured correctly."
        );
    }

    const transportOptions = {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure
    };

    /**
     * SMTP authentication is optional because some SMTP
     * providers use IP-based authentication.
     */
    if (emailConfig.user && emailConfig.password) {
        transportOptions.auth = {
            user: emailConfig.user,
            pass: emailConfig.password
        };
    }

    return nodemailer.createTransport(transportOptions);
};

/**
 * Escapes HTML special characters.
 *
 * Prevents user-controlled values from being interpreted
 * as HTML markup inside email templates.
 *
 * @param {string} value - Input value.
 * @returns {string} Escaped HTML string.
 */
const escapeHtml = (value) => {
    return String(value).replace(
        /[&<>"']/g,
        (character) => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        }
    );
};

/**
 * Formats an invitation expiry date for email display.
 *
 * @param {Date|string} expiresAt - Invitation expiry date.
 * @returns {string} Formatted date and time.
 */
const formatExpiryDate = (expiresAt) => {
    const date = new Date(expiresAt);

    if (Number.isNaN(date.getTime())) {
        throw new Error(
            "Invalid invitation expiry date."
        );
    }

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata"
    }).format(date);
};

/**
 * Sends an organisation invitation email.
 *
 * The invitation URL contains the raw invitation token.
 * The token itself must never be logged or persisted by
 * this email service.
 *
 * @param {Object} options - Invitation email information.
 * @param {string} options.to - Recipient email address.
 * @param {string} options.organizationName - Organisation name.
 * @param {string} options.role - Invited membership role.
 * @param {string} options.invitationUrl - Invitation acceptance URL.
 * @param {Date|string} options.expiresAt - Invitation expiry.
 * @returns {Promise<Object>} Nodemailer delivery information.
 */
export const sendOrganizationInvitationEmail = async ({
    to,
    organizationName,
    role,
    invitationUrl,
    expiresAt
}) => {
    if (!to || !organizationName || !role || !invitationUrl || !expiresAt) {
        throw new Error(
            "Required organisation invitation email information is missing."
        );
    }

    const normalizedRole = String(role).toLowerCase();

    if (!["trainer", "trainee"].includes(normalizedRole)) {
        throw new Error(
            "Invalid organisation invitation role."
        );
    }

    let parsedInvitationUrl;

    try {
        parsedInvitationUrl = new URL(invitationUrl);
    } catch {
        throw new Error(
            "Invalid organisation invitation URL."
        );
    }

    if (!["http:", "https:"].includes(parsedInvitationUrl.protocol)) {
        throw new Error(
            "Invitation URL must use HTTP or HTTPS."
        );
    }

    const safeOrganizationName = escapeHtml(organizationName);
    const safeRole = escapeHtml(normalizedRole);
    const safeInvitationUrl = escapeHtml(invitationUrl);
    const formattedExpiry = formatExpiryDate(expiresAt);

    const transport = createEmailTransport();

    const subject = `You're invited to join ${organizationName} on Ascendra`;

    const text = [
        `You have been invited to join ${organizationName} on Ascendra.`,
        "",
        `Invited role: ${normalizedRole}`,
        "",
        "Accept your invitation using the link below:",
        invitationUrl,
        "",
        `This invitation expires on ${formattedExpiry}.`,
        "",
        "If you were not expecting this invitation, you can ignore this email."
    ].join("\n");

    const html = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Organisation Invitation</title>
            </head>

            <body style="
                margin: 0;
                padding: 24px;
                background-color: #f4f6f8;
                font-family: Arial, Helvetica, sans-serif;
                color: #1f2937;
            ">
                <div style="
                    max-width: 560px;
                    margin: 0 auto;
                    padding: 32px;
                    background-color: #ffffff;
                    border-radius: 10px;
                ">
                    <h2 style="
                        margin-top: 0;
                        color: #111827;
                    ">
                        You're invited to Ascendra
                    </h2>

                    <p>
                        You have been invited to join
                        <strong>${safeOrganizationName}</strong>
                        on Ascendra.
                    </p>

                    <p>
                        Your invited role is:
                        <strong>${safeRole}</strong>
                    </p>

                    <p>
                        Accept your invitation using the button below.
                    </p>

                    <p style="margin: 28px 0;">
                        <a
                            href="${safeInvitationUrl}"
                            style="
                                display: inline-block;
                                padding: 12px 24px;
                                background-color: #2563eb;
                                color: #ffffff;
                                text-decoration: none;
                                border-radius: 6px;
                                font-weight: bold;
                            "
                        >
                            Accept Invitation
                        </a>
                    </p>

                    <p style="
                        font-size: 14px;
                        color: #4b5563;
                    ">
                        This invitation expires on
                        <strong>${escapeHtml(formattedExpiry)}</strong>.
                    </p>

                    <p style="
                        font-size: 13px;
                        color: #6b7280;
                    ">
                        If you were not expecting this invitation,
                        you can safely ignore this email.
                    </p>

                    <hr style="
                        margin: 28px 0;
                        border: none;
                        border-top: 1px solid #e5e7eb;
                    " />

                    <p style="
                        margin-bottom: 0;
                        font-size: 12px;
                        color: #9ca3af;
                    ">
                        This is an automated email from Ascendra.
                        Please do not reply to this message.
                    </p>
                </div>
            </body>
        </html>
    `;

    return transport.sendMail({
        from: env.email.from,
        to,
        subject,
        text,
        html
    });
};

/**
 * Sends a password-reset link to a registered user.
 *
 * @param {Object} options - Password-reset email information.
 * @param {string} options.to - Recipient email address.
 * @param {string} options.firstName - Recipient's first name.
 * @param {string} options.resetUrl - Password-reset URL.
 * @param {Date|string} options.expiresAt - Reset-link expiry.
 * @returns {Promise<Object>} Nodemailer delivery information.
 */
export const sendPasswordResetEmail = async ({
    to,
    firstName,
    resetUrl,
    expiresAt
}) => {
    if (!to || !firstName || !resetUrl || !expiresAt) {
        throw new Error(
            "Required password-reset email information is missing."
        );
    }

    let parsedResetUrl;

    try {
        parsedResetUrl = new URL(resetUrl);
    } catch {
        throw new Error("Invalid password-reset URL.");
    }

    if (!["http:", "https:"].includes(parsedResetUrl.protocol)) {
        throw new Error("Password-reset URL must use HTTP or HTTPS.");
    }

    const formattedExpiry = formatExpiryDate(expiresAt);
    const safeFirstName = escapeHtml(firstName);
    const safeResetUrl = escapeHtml(resetUrl);
    const transport = createEmailTransport();

    const text = [
        `Hello ${firstName},`,
        "",
        "We received a request to reset your Ascendra password.",
        "Use the link below to choose a new password:",
        resetUrl,
        "",
        `This link expires on ${formattedExpiry}.`,
        "",
        "If you did not request a password reset, you can ignore this email."
    ].join("\n");

    const html = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Reset your Ascendra password</title>
            </head>
            <body style="
                margin: 0;
                padding: 24px;
                background-color: #f4f6f8;
                font-family: Arial, Helvetica, sans-serif;
                color: #1f2937;
            ">
                <div style="
                    max-width: 560px;
                    margin: 0 auto;
                    padding: 32px;
                    background-color: #ffffff;
                    border-radius: 10px;
                ">
                    <h2 style="margin-top: 0; color: #111827;">
                        Reset your password
                    </h2>
                    <p>Hello ${safeFirstName},</p>
                    <p>
                        We received a request to reset your Ascendra password.
                        Use the button below to choose a new password.
                    </p>
                    <p style="margin: 28px 0;">
                        <a href="${safeResetUrl}" style="
                            display: inline-block;
                            padding: 12px 24px;
                            background-color: #2563eb;
                            color: #ffffff;
                            text-decoration: none;
                            border-radius: 6px;
                            font-weight: bold;
                        ">
                            Reset Password
                        </a>
                    </p>
                    <p style="font-size: 14px; color: #4b5563;">
                        This link expires on
                        <strong>${escapeHtml(formattedExpiry)}</strong>.
                    </p>
                    <p style="font-size: 13px; color: #6b7280;">
                        If you did not request a password reset, you can
                        safely ignore this email.
                    </p>
                </div>
            </body>
        </html>
    `;

    return transport.sendMail({
        from: env.email.from,
        to,
        subject: "Reset your Ascendra password",
        text,
        html
    });
};
