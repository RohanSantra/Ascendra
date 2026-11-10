import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../../src/modules/trainerProfiles/trainerProfile.model.js";
import {
    updateMyTrainerAvailabilityHandler
} from "../../../../src/modules/trainerProfiles/trainerProfile.controller.js";
import {
    getMyTrainerProfileHandler,
    updateMyTrainerProfessionalDetailsHandler
} from "../../../../src/modules/trainerProfiles/trainerProfile.controller.js";
import {
    getPendingTrainerApprovals
} from "../../../../src/modules/trainerProfiles/trainerApproval.controller.js";
import {
    approveTrainer,
    rejectTrainer,
    suspendTrainer
} from "../../../../src/modules/trainerProfiles/trainerApproval.controller.js";

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


test("trainer profile controller persists and returns availability updates", async (t) => {
    const orgId = id();
    const userId = id();
    const profile = {
        _id: id(),
        org: orgId,
        user: userId,
        professionalDetails: {},
        approval: { status: "approved" },
        competencySummary: [],
        skills: [],
        evidenceStats: {},
        experience: {},
        availability: { activeTrainings: 1, maxConcurrentTrainings: 2 },
        completion: {},
        save: async () => {}
    };
    let wasSaved = false;
    profile.save = async () => {
        wasSaved = true;
    };
    t.mock.method(TrainerProfile, "findOne", () => query(profile));

    const response = await invoke(updateMyTrainerAvailabilityHandler, {
        user: { orgId, userId },
        validated: { body: { status: "limited", maxConcurrentTrainings: 3 } }
    });

    assert.equal(wasSaved, true);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.trainerProfile.availability.status, "limited");
    assert.equal(response.body.data.trainerProfile.availability.maxConcurrentTrainings, 3);
});


test("trainer approval controller returns an empty pending list with pagination", async (t) => {
    const orgId = id();
    t.mock.method(OrganizationMembership, "find", () => query([]));

    const response = await invoke(getPendingTrainerApprovals, {
        user: { orgId },
        validated: { query: { page: 2, limit: 10 } }
    });


    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, []);
    assert.deepEqual(response.body.meta.pagination, {
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0
    });


});

test("trainer approval controller serializes pending trainers with membership filters", async (t) => {
    const orgId = id();
    const trainerId = id();
    const profile = {
        _id: id(),
        org: orgId,
        user: { _id: trainerId, firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" },
        professionalDetails: { headline: "Instructor" },
        approval: { status: "pending" },
        evidenceStats: {},
        experience: {},
        completion: {}
    };
    t.mock.method(OrganizationMembership, "find", () => query([{ user: trainerId }]));
    t.mock.method(TrainerProfile, "find", () => query([profile]));
    t.mock.method(TrainerProfile, "countDocuments", async () => 1);

    const response = await invoke(getPendingTrainerApprovals, {
        user: { orgId },
        validated: { query: { page: 1, limit: 5 } }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data[0].user.firstName, "Ada");
    assert.equal(response.body.data[0].user.phone, null);
    assert.deepEqual(response.body.meta.pagination, {
        page: 1, limit: 5, total: 1, totalPages: 1
    });
});


test("trainer approval controller approves a profile in the current organization", async (t) => {
    const orgId = id();
    const adminId = id();
    const trainerId = id();
    const profileId = id();
    const profile = {
        _id: profileId,
        org: orgId,
        user: trainerId,
        professionalDetails: {},
        approval: { status: "pending" },
        evidenceStats: {},
        experience: {},
        completion: {},
        save: async () => {}
    };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(TrainerProfile, "findOne", () => query(profile));
    t.mock.method(OrganizationMembership, "findOne", () => query({ _id: id() }));

    const response = await invoke(approveTrainer, {
        user: { orgId, userId: adminId },
        validated: { params: { id: profileId.toString() } }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.trainerProfile.approval.status, "approved");
    assert.equal(response.body.data.trainerProfile.approval.reviewedBy, adminId.toString());
});

test("trainer profile controller reads and updates professional details", async (t) => {
    const orgId = id();
    const userId = id();
    const profile = {
        _id: id(), org: orgId, user: userId,
        professionalDetails: { headline: "Instructor", bio: "" },
        approval: { status: "pending" }, competencySummary: [], skills: [],
        evidenceStats: {}, experience: {}, availability: {}, completion: {},
        save: async () => {}
    };
    t.mock.method(TrainerProfile, "findOne", () => query(profile));
    const req = {
        user: { orgId, userId },
        validated: { body: { headline: "Senior instructor", status: "approved" } }
    };

    const read = await invoke(getMyTrainerProfileHandler, req);
    const updated = await invoke(updateMyTrainerProfessionalDetailsHandler, req);

    assert.equal(read.status, 200);
    assert.equal(read.body.data.trainerProfile.id, profile._id.toString());
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.trainerProfile.professionalDetails.headline, "Senior instructor");
    assert.equal(profile.approval.status, "pending");
});

test("trainer approval controller rejects and suspends eligibility", async (t) => {
    const orgId = id();
    const adminId = id();
    const trainerId = id();
    const profileId = id();
    const profile = {
        _id: profileId, org: orgId, user: trainerId,
        professionalDetails: {}, approval: { status: "pending" },
        evidenceStats: {}, experience: {}, completion: {}, save: async () => {}
    };
    const membership = { _id: id(), status: "approved", save: async () => {} };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(TrainerProfile, "findOne", () => query(profile));
    t.mock.method(OrganizationMembership, "findOne", () => query(membership));

    const rejected = await invoke(rejectTrainer, {
        user: { orgId, userId: adminId },
        validated: { params: { id: profileId }, body: { reason: "Incomplete credentials" } }
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.data.trainerProfile.approval.status, "rejected");
    assert.equal(rejected.body.data.trainerProfile.approval.rejectionReason, "Incomplete credentials");

    profile.approval.status = "approved";
    const suspended = await invoke(suspendTrainer, {
        user: { orgId, userId: adminId },
        validated: { params: { id: profileId }, body: { reason: "Policy review" } }
    });
    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.data.trainerProfile.approval.status, "suspended");
    assert.equal(membership.status, "suspended");
});
