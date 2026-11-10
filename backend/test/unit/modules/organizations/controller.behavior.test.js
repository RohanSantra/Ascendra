import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Organization from "../../../../src/modules/organizations/organization.model.js";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import {
    getDiscoverableOrganizations
} from "../../../../src/modules/organizations/organization.controller.js";
import {
    submitOrganizationApplication
} from "../../../../src/modules/organizations/organization.controller.js";
import {
    getPendingOrganizationApplications,
    approveOrganization,
    rejectOrganization,
    suspendOrganizationController,
    reactivateOrganizationController
} from "../../../../src/modules/organizations/organization.controller.js";

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


test("organization discovery controller returns listed organizations and pagination", async (t) => {
    const orgId = id();
    const organization = {
        _id: orgId,
        name: "North",
        slug: "north"
    };
    t.mock.method(Organization, "find", () => query([organization]));
    t.mock.method(Organization, "countDocuments", () => Promise.resolve(1));

    const response = await invoke(getDiscoverableOrganizations, {
        validated: { query: { page: 1, limit: 10 } }
    });


    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, [organization]);
    assert.deepEqual(response.body.meta, {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
    });
});


test("organization application controller returns the created application and pending membership", async (t) => {
    const applicantId = id();
    const organization = {
        _id: id(),
        name: "North",
        slug: "north",
        status: "pending",
        createdAt: new Date()
    };
    const membership = {
        _id: id(),
        role: "admin",
        status: "pending"
    };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(Organization, "exists", () => query(null));
    t.mock.method(Organization, "create", async () => [organization]);
    t.mock.method(OrganizationMembership, "create", async () => [membership]);

    const response = await invoke(submitOrganizationApplication, {
        user: { userId: applicantId },
        validated: {
            body: { name: "North", slug: "north" }
        }
    });



    assert.equal(response.status, 201);
    assert.equal(response.body.data.organization.id, organization._id);
    assert.equal(response.body.data.membership.id, membership._id);
});


test("organization review and lifecycle controllers persist decisions", async (t) => {
    const orgId = id();
    const adminId = id();
    const applicantId = id();
    const organization = {
        _id: orgId,
        createdBy: applicantId,
        name: "North",
        slug: "north",
        status: "pending",
        save: async () => {}
    };
    const membership = {
        _id: id(),
        org: orgId,
        user: applicantId,
        role: "admin",
        status: "pending",
        save: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(Organization, "find", () => query([organization]));
    t.mock.method(Organization, "countDocuments", () => Promise.resolve(1));
    t.mock.method(Organization, "findOne", () => query(organization));
    t.mock.method(OrganizationMembership, "findOne", () => query(membership));

    const pending = await invoke(getPendingOrganizationApplications, {
        validated: { query: { page: 1, limit: 10 } }
    });
    assert.equal(pending.status, 200);
    assert.deepEqual(pending.body.data, [organization]);

    const approval = await invoke(approveOrganization, {
        user: { userId: adminId },
        validated: { params: { id: orgId.toString() } }
    });
    assert.equal(approval.status, 200);
    assert.equal(approval.body.data.organization.status, "active");
    assert.equal(approval.body.data.membership.status, "approved");

    organization.status = "pending";
    membership.status = "pending";
    const rejection = await invoke(rejectOrganization, {
        user: { userId: adminId },
        validated: { params: { id: orgId.toString() }, body: { reason: "Incomplete application" } }
    });
    assert.equal(rejection.status, 200);
    assert.equal(rejection.body.data.organization.status, "rejected");
    assert.equal(rejection.body.data.membership.rejectionReason, "Incomplete application");

    organization.status = "active";
    const suspension = await invoke(suspendOrganizationController, {
        user: { userId: adminId },
        validated: { params: { id: orgId.toString() }, body: { reason: "Policy review" } }
    });
    assert.equal(suspension.status, 200);
    assert.equal(suspension.body.data.status, "suspended");

    organization.status = "suspended";
    const reactivation = await invoke(reactivateOrganizationController, {
        user: { userId: adminId },
        validated: { params: { id: orgId.toString() }, body: { reason: "Review complete" } }
    });
    assert.equal(reactivation.status, 200);
    assert.equal(reactivation.body.data.status, "active");
});
