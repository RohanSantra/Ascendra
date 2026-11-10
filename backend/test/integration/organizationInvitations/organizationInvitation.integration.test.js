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
import Organization from "../../../src/modules/organizations/organization.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../src/modules/trainerProfiles/trainerProfile.model.js";
import OrganizationInvitation from "../../../src/modules/organizationInvitations/organizationInvitation.model.js";
import {
    createOrganizationInvitation,
    acceptOrganizationInvitation
} from "../../../src/modules/organizationInvitations/organizationInvitation.service.js";

let organization;
let inviter;
let invitedUser;

before(async () => {
    await startTestDatabase();
});

after(async () => {
    await stopTestDatabase();
});

beforeEach(async () => {
    await clearTestDatabase();

    inviter = await User.create({
        firstName: "Organization",
        lastName: "Admin",
        email: "admin@example.com"
    });

    invitedUser = await User.create({
        firstName: "Invited",
        lastName: "Member",
        email: "member@example.com"
    });

    organization = await Organization.create({
        name: "Invitation Organization",
        slug: "invitation-organization",
        status: "active",
        createdBy: inviter._id
    });
});

const hashToken = (token) =>
    createHash("sha256").update(token).digest("hex");

const createInvitation = async ({
    role = "trainee",
    email = invitedUser.email,
    token = "b".repeat(64),
    expiresAt = new Date(Date.now() + 60 * 60 * 1000)
} = {}) => {
    await OrganizationInvitation.create({
        org: organization._id,
        email,
        role,
        tokenHash: hashToken(token),
        invitedBy: inviter._id,
        expiresAt
    });

    return token;
};

test(
    "sends invitations without persisting the raw token",
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
            const result = await createOrganizationInvitation({
                orgId: organization._id,
                adminId: inviter._id,
                email: invitedUser.email,
                role: "trainer",
                expiresInDays: 7
            });

            assert.equal(result.status, "pending");
            assert.equal(messages.length, 1);
            assert.equal(messages[0].to, invitedUser.email);

            const invitationUrl = new URL(
                messages[0].text.match(/https?:\/\/\S+/)[0]
            );
            const rawToken = invitationUrl.searchParams.get("token");

            assert.match(rawToken, /^[a-f0-9]{64}$/);

            const savedInvitation = await OrganizationInvitation
                .findById(result.id)
                .lean();

            assert.equal(savedInvitation.tokenHash, undefined);
            assert.equal(
                savedInvitation.status,
                "pending"
            );

            const storedInvitation = await OrganizationInvitation
                .findById(result.id)
                .select("+tokenHash")
                .lean();

            assert.equal(storedInvitation.tokenHash, hashToken(rawToken));
            assert.notEqual(storedInvitation.tokenHash, rawToken);
        } finally {
            transportMock.mock.restore();
        }
    }
);

test(
    "accepts a trainer invitation and keeps trainer eligibility separate",
    async () => {
        const token = await createInvitation({ role: "trainer" });

        await OrganizationMembership.create({
            org: organization._id,
            user: invitedUser._id,
            role: "trainee",
            status: "pending"
        });

        const membership = await acceptOrganizationInvitation({
            token,
            userId: invitedUser._id
        });

        assert.equal(membership.role, "trainer");
        assert.equal(membership.status, "approved");
        assert.equal(membership.approvedBy, inviter._id.toString());

        const trainerProfile = await TrainerProfile.findOne({
            org: organization._id,
            user: invitedUser._id
        }).lean();

        assert.ok(trainerProfile);
        assert.equal(trainerProfile.approval.status, "pending");

        const invitation = await OrganizationInvitation.findOne({
            org: organization._id
        }).lean();

        assert.equal(invitation.status, "accepted");
        assert.equal(invitation.acceptedBy.toString(), invitedUser._id.toString());
    }
);

test(
    "accepts a trainee invitation without creating a trainer profile",
    async () => {
        const token = await createInvitation({ role: "trainee" });

        const membership = await acceptOrganizationInvitation({
            token,
            userId: invitedUser._id
        });

        assert.equal(membership.role, "trainee");
        assert.equal(membership.status, "approved");
        assert.equal(
            await TrainerProfile.countDocuments({
                org: organization._id,
                user: invitedUser._id
            }),
            0
        );
    }
);

test(
    "does not consume an invitation when the account email does not match",
    async () => {
        const token = await createInvitation();
        invitedUser.email = "different@example.com";
        await invitedUser.save();

        await assert.rejects(
            acceptOrganizationInvitation({
                token,
                userId: invitedUser._id
            }),
            (error) => {
                assert.equal(error.code, "INVITATION_EMAIL_MISMATCH");
                return true;
            }
        );

        const invitation = await OrganizationInvitation.findOne({
            org: organization._id
        }).lean();

        assert.equal(invitation.status, "pending");
        assert.equal(
            await OrganizationMembership.countDocuments({
                org: organization._id,
                user: invitedUser._id
            }),
            0
        );
    }
);
