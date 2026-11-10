import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Organization from "../../../../src/modules/organizations/organization.model.js";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../../src/modules/trainerProfiles/trainerProfile.model.js";
import {
    createMembershipRequest
} from "../../../../src/modules/organizationMemberships/organizationMembership.service.js";
import {
    listMyMemberships,
    listPendingMemberships
} from "../../../../src/modules/organizationMemberships/organizationMembership.service.js";

const id = () => new mongoose.Types.ObjectId();


const createQuery = (result) => ({
    select() {
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

    populate() {
        return this;
    },

    session() {
        return this;
    },

    lean() {
        return Promise.resolve(result);
    },

    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    }
});


const createSession = () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {}
});


test("trainer membership request creates a pending membership and profile atomically", async (t) => {
    const orgId = id();
    const userId = id();
    const membership = {
        _id: id(),
        org: orgId,
        user: userId,
        role: "trainer",
        status: "pending"
    };
    let profileUpdate;
    let membershipCreateOptions;

    t.mock.method(mongoose, "startSession", async () => createSession());
    t.mock.method(Organization, "findOne", () => createQuery({ _id: orgId }));
    t.mock.method(OrganizationMembership, "findOne", () => createQuery(null));
    t.mock.method(OrganizationMembership, "create", async (_records, options) => {
        membershipCreateOptions = options;
        return [membership];
    });




    t.mock.method(TrainerProfile, "updateOne", async (filter, update, options) => {
        profileUpdate = { filter, update, options };
        return {};
    });

    const result = await createMembershipRequest({
        orgId,
        userId,
        role: "trainer"
    });

    assert.deepEqual(result, {
        id: membership._id.toString(),
        orgId: orgId.toString(),
        userId: userId.toString(),
        role: "trainer",
        status: "pending",
        joinedAt: undefined,
        approvedBy: null,
        approvedAt: undefined,
        rejectedBy: null,
        rejectedAt: undefined,
        rejectionReason: undefined,
        suspendedBy: null,
        suspendedAt: undefined,
        createdAt: undefined,
        updatedAt: undefined
    });
    assert.ok(membershipCreateOptions.session);
    assert.deepEqual(profileUpdate.filter, { org: orgId, user: userId });
    assert.deepEqual(profileUpdate.update.$setOnInsert, { org: orgId, user: userId });
    assert.equal(profileUpdate.options.upsert, true);
});


test("membership service serializes populated and missing organization references", async (t) => {
    const userId = id();
    const organization = {
        _id: id(),
        name: "North",
        slug: "north",
        status: "active"
    };
    const memberships = [
        {
            _id: id(),
            role: "trainer",
            status: "approved",
            user: userId,
            org: organization,
            createdAt: new Date()
        },
        {
            _id: id(),
            role: "trainee",
            status: "rejected",
            user: userId,
            org: null,
            createdAt: new Date(),
            rejectionReason: "No longer eligible"
        }
    ];
    t.mock.method(OrganizationMembership, "find", (filter) => {
        assert.deepEqual(filter, { user: userId });
        return createQuery(memberships);
    });

    const result = await listMyMemberships(userId);

    assert.equal(result.length, 2);
    assert.equal(result[0].organization.id, organization._id.toString());
    assert.equal(result[0].organization.status, "active");
    assert.equal(result[1].organization, null);
    assert.equal(result[1].rejectionReason, "No longer eligible");
});


test("membership service lists pending requests with public user details and pagination", async (t) => {
    const orgId = id();
    const userId = id();
    const membership = {
        _id: id(),
        role: "trainee",
        status: "pending",
        user: {
            _id: userId,
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@example.com"
        },
        createdAt: new Date()
    };
    let capturedFilter;
    t.mock.method(OrganizationMembership, "find", (filter) => {
        capturedFilter = filter;
        return createQuery([membership]);
    });
    t.mock.method(OrganizationMembership, "countDocuments", () => Promise.resolve(4));

    const result = await listPendingMemberships({
        orgId,
        page: 2,
        limit: 1
    });

    assert.deepEqual(capturedFilter, { org: orgId, status: "pending" });
    assert.equal(result.items[0].user.id, userId.toString());
    assert.equal(result.items[0].user.phone, null);
    assert.deepEqual(result.pagination, {
        page: 2,
        limit: 1,
        total: 4,
        totalPages: 4
    });
});
