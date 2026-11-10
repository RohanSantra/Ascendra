import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import Organization from "../../../../src/modules/organizations/organization.model.js";
import TrainerProfile from "../../../../src/modules/trainerProfiles/trainerProfile.model.js";
import {
    getMyMemberships
} from "../../../../src/modules/organizationMemberships/organizationMembership.controller.js";
import {
    approveOrganizationMembership
} from "../../../../src/modules/organizationMemberships/organizationMembership.controller.js";
import {
    requestOrganizationMembership,
    getPendingMemberships,
    rejectOrganizationMembership,
    suspendOrganizationMembership
} from "../../../../src/modules/organizationMemberships/organizationMembership.controller.js";

const id = () => new mongoose.Types.ObjectId();


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


const session = () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {}
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


test("membership controller returns the signed-in user's populated organizations", async (t) => {
    const userId = id();
    const orgId = id();
    const membership = {
        _id: id(),
        user: userId,
        role: "trainer",
        status: "approved",
        org: {
            _id: orgId,
            name: "North",
            slug: "north",
            status: "active"
        }
    };
    t.mock.method(OrganizationMembership, "find", (filter) => {
        assert.deepEqual(filter, { user: userId });
        return query([membership]);
    });


    const response = await invoke(getMyMemberships, {
        user: { userId }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.memberships[0].organization.id, orgId.toString());
    assert.equal(response.body.data.memberships[0].role, "trainer");
});


test("membership approval controller records the current admin", async (t) => {
    const orgId = id();
    const adminId = id();
    const membershipId = id();
    const membership = {
        _id: membershipId,
        org: orgId,
        user: id(),
        role: "trainer",
        status: "pending",
        save: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(OrganizationMembership, "findOne", () => query(membership));

    const response = await invoke(approveOrganizationMembership, {
        user: { orgId, userId: adminId },
        validated: { params: { id: membershipId.toString() } }
    });









    assert.equal(response.status, 200);
    assert.equal(response.body.data.membership.status, "approved");
    assert.equal(response.body.data.membership.approvedBy, adminId.toString());
    assert.ok(response.body.data.membership.approvedAt);
});


test("membership request controller creates a trainer request and profile", async (t) => {
    const orgId = id();
    const userId = id();
    const membership = {
        _id: id(),
        org: orgId,
        user: userId,
        role: "trainer",
        status: "pending"
    };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(Organization, "findOne", () => query({ _id: orgId }));
    t.mock.method(OrganizationMembership, "findOne", () => query(null));
    t.mock.method(OrganizationMembership, "create", async () => [membership]);
    t.mock.method(TrainerProfile, "updateOne", async () => ({}));

    const response = await invoke(requestOrganizationMembership, {
        user: { userId },
        validated: { body: { orgId, role: "trainer" } }
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.membership.id, membership._id.toString());
    assert.equal(response.body.data.membership.status, "pending");
});


test("pending membership controller returns paginated requests", async (t) => {
    const orgId = id();
    t.mock.method(OrganizationMembership, "find", () => query([]));
    t.mock.method(OrganizationMembership, "countDocuments", () => Promise.resolve(0));

    const response = await invoke(getPendingMemberships, {
        user: { orgId },
        validated: { query: { page: 1, limit: 15 } }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, []);
    assert.deepEqual(response.body.meta.pagination, {
        page: 1,
        limit: 15,
        total: 0,
        totalPages: 0
    });
});


test("membership rejection controller records the supplied decision", async (t) => {
    const orgId = id();
    const adminId = id();
    const membership = {
        _id: id(),
        org: orgId,
        user: id(),
        role: "trainee",
        status: "pending",
        save: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(OrganizationMembership, "findOne", () => query(membership));

    const response = await invoke(rejectOrganizationMembership, {
        user: { orgId, userId: adminId },
        validated: {
            params: { id: membership._id.toString() },
            body: { reason: "Request incomplete" }
        }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.membership.status, "rejected");
    assert.equal(response.body.data.membership.rejectionReason, "Request incomplete");
});


test("membership suspension controller suspends trainer eligibility together", async (t) => {
    const orgId = id();
    const adminId = id();
    const trainerId = id();
    const membership = {
        _id: id(),
        org: orgId,
        user: trainerId,
        role: "trainer",
        status: "approved",
        save: async () => {}
    };
    const profile = {
        approval: { status: "approved" },
        save: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(OrganizationMembership, "findOne", () => query(membership));
    t.mock.method(TrainerProfile, "findOne", () => query(profile));

    const response = await invoke(suspendOrganizationMembership, {
        user: { orgId, userId: adminId },
        validated: { params: { id: membership._id.toString() } }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.membership.status, "suspended");
    assert.equal(profile.approval.status, "suspended");
    assert.equal(profile.approval.reviewedBy.toString(), adminId.toString());
});
