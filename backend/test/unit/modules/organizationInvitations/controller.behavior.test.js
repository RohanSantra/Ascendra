import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import OrganizationInvitation from "../../../../src/modules/organizationInvitations/organizationInvitation.model.js";
import Organization from "../../../../src/modules/organizations/organization.model.js";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../../src/modules/trainerProfiles/trainerProfile.model.js";
import User from "../../../../src/modules/auth/user.model.js";
import {
    getOrganizationInvitations,
    createInvitation,
    acceptInvitation,
    revokeInvitation
} from "../../../../src/modules/organizationInvitations/organizationInvitation.controller.js";

const id = () => new mongoose.Types.ObjectId();


const session = () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {}
});


const query = (value) => ({
    select() {
        return this;
    },
    populate() {
        return this;
    },
    sort() {
        return this;
    },
    skip() {
        return this;
    },
    limit() {
        return this;
    },
    session() {
        return this;
    },
    lean() {
        return Promise.resolve(value);
    },
    then(resolve, reject) {
        return Promise.resolve(value).then(resolve, reject);
    }
});


const invoke = async (handler, req) => {
    let status;
    let body;
    const errors = [];
    const res = {
        req: {},
        status(value) {
            status = value;
            return this;
        },
        json(value) {
            body = value;
            return this;
        }
    };

    handler(req, res, (error) => errors.push(error));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(errors, []);
    return { status, body };
};


test("invitation controller lists invitations and synchronizes expired states", async (t) => {
    const orgId = id();
    let updateManyCalled = false;
    let selectedProjection;
    t.mock.method(OrganizationInvitation, "updateMany", async () => {
        updateManyCalled = true;
        return { modifiedCount: 0 };
    });
    t.mock.method(OrganizationInvitation, "find", () => {
        const result = query([]);
        const select = result.select;
        result.select = function (fields) {
            selectedProjection = fields;
            return select.call(this, fields);
        };
        return result;
    });
    t.mock.method(OrganizationInvitation, "countDocuments", () => Promise.resolve(0));

    const response = await invoke(getOrganizationInvitations, {
        user: { orgId },
        validated: { query: { page: 1, limit: 20, status: "pending" } }
    });



    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, []);
    assert.equal(updateManyCalled, true);
    assert.equal(selectedProjection, "-tokenHash");
});


test("invitation acceptance controller accepts and returns a trainer membership", async (t) => {
    const orgId = id();
    const userId = id();
    const invitation = {
        _id: id(),
        org: orgId,
        email: "trainer@example.com",
        role: "trainer",
        invitedBy: id()
    };
    const membership = {
        _id: id(),
        org: orgId,
        user: userId,
        role: "trainer",
        status: "approved",
        joinedAt: new Date(),
        approvedBy: invitation.invitedBy,
        approvedAt: new Date()
    };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(OrganizationInvitation, "findOneAndUpdate", async () => invitation);
    t.mock.method(User, "findOne", () => query({
        _id: userId,
        email: "trainer@example.com"
    }));
    t.mock.method(Organization, "findOne", () => query({ _id: orgId }));
    t.mock.method(OrganizationMembership, "findOne", () => query(null));
    t.mock.method(OrganizationMembership, "create", async () => [membership]);
    t.mock.method(TrainerProfile, "updateOne", async () => ({}));

    const response = await invoke(acceptInvitation, {
        user: { userId },
        validated: { body: { token: "a".repeat(64) } }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.role, "trainer");
    assert.equal(response.body.data.status, "approved");
});


test("invitation revocation controller returns the transitioned invitation", async (t) => {
    const orgId = id();
    const adminId = id();
    const invitationId = id();
    const invitation = {
        _id: invitationId,
        org: orgId,
        email: "trainer@example.com",
        role: "trainer",
        status: "revoked",
        invitedBy: adminId,
        expiresAt: new Date(Date.now() + 86400000),
        acceptedAt: null,
        revokedBy: adminId,
        revokedAt: new Date()
    };
    t.mock.method(OrganizationInvitation, "findOneAndUpdate", async () => invitation);

    const response = await invoke(revokeInvitation, {
        user: { orgId, userId: adminId },
        validated: { params: { id: invitationId.toString() } }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "revoked");
    assert.equal(response.body.data.email, "trainer@example.com");
});


test("invitation creation controller delivers and returns a pending invitation", async (t) => {
    const orgId = id();
    const adminId = id();
    const invitationId = id();
    const created = {
        _id: invitationId,
        org: orgId,
        email: "trainer@example.com",
        role: "trainer",
        status: "pending",
        invitedBy: adminId,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
    };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(nodemailer, "createTransport", () => ({
        sendMail: async () => ({ messageId: "test-message" })
    }));
    t.mock.method(Organization, "findOne", () => query({
        _id: orgId,
        name: "North"
    }));
    t.mock.method(User, "findOne", () => query(null));
    t.mock.method(OrganizationInvitation, "updateMany", async () => ({}));
    t.mock.method(OrganizationInvitation, "findOne", () => query(null));
    t.mock.method(OrganizationInvitation, "create", async () => [created]);

    const response = await invoke(createInvitation, {
        user: { orgId, userId: adminId },
        validated: {
            body: {
                email: "trainer@example.com",
                role: "trainer",
                expiresInDays: 2
            }
        }
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.email, "trainer@example.com");
    assert.equal(response.body.data.status, "pending");
});
