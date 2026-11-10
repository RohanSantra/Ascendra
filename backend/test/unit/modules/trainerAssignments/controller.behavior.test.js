import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import TrainerAssignment from "../../../../src/modules/trainerAssignments/trainerAssignment.model.js";
import MatchRun from "../../../../src/modules/matchRun/matchRun.model.js";
import TrainerProfile from "../../../../src/modules/trainerProfiles/trainerProfile.model.js";
import TrainingRequirement from "../../../../src/modules/trainingRequirements/trainingRequirement.model.js";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import {
    createTrainerAssignmentHandler,
    getTrainerAssignmentListHandler,
    getTrainerAssignmentDetailsHandler,
    startTrainerAssignmentHandler,
    completeTrainerAssignmentHandler,
    cancelTrainerAssignmentHandler
} from "../../../../src/modules/trainerAssignments/trainerAssignment.controller.js";

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


test("trainer assignment controller returns filtered assignment data", async (t) => {
    const orgId = id();
    const assignment = {
        _id: id(),
        org: orgId,
        requirement: { title: "Course", status: "assigned" },
        trainer: { firstName: "Ada", lastName: "Lovelace" },
        trainerProfile: { professionalDetails: { headline: "Trainer" } },
        status: "assigned",
        assignedAt: new Date()
    };
    t.mock.method(TrainerAssignment, "find", () => query([assignment]));
    t.mock.method(TrainerAssignment, "countDocuments", () => Promise.resolve(1));

    const response = await invoke(getTrainerAssignmentListHandler, {
        user: { orgId },
        validated: {
            query: { page: 1, limit: 20, status: "assigned" }
        }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.assignments, [assignment]);
    assert.deepEqual(response.body.meta.pagination, {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
    });
});

test("trainer assignment controller creates an assignment with request context", async (t) => {
    const orgId = id();
    const userId = id();
    const requirementId = id();
    const matchRunId = id();
    const trainerProfileId = id();
    const dates = { startDate: new Date("2026-02-01"), endDate: new Date("2026-02-03") };
    const assignment = { _id: id(), status: "assigned" };
    const requirement = { _id: requirementId, status: "matched" };
    const profile = { _id: trainerProfileId, user: id() };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(TrainingRequirement, "findOne", () => query(requirement));
    t.mock.method(MatchRun, "findOne", () => query({
        requirement: requirementId,
        results: [{ trainerProfile: trainerProfileId }]
    }));
    t.mock.method(TrainerProfile, "findOne", () => query(profile));
    t.mock.method(OrganizationMembership, "findOne", () => query({ _id: id() }));
    t.mock.method(TrainerAssignment, "findOne", () => query(null));
    t.mock.method(TrainerProfile, "findOneAndUpdate", () => Promise.resolve(profile));
    let insertedData;
    t.mock.method(TrainerAssignment, "create", async ([data]) => {
        insertedData = data;
        return [assignment];
    });
    t.mock.method(TrainingRequirement, "findOneAndUpdate", () => Promise.resolve(requirement));

    const response = await invoke(createTrainerAssignmentHandler, {
        user: { orgId, userId },
        validated: {
            params: { requirementId },
            body: { matchRunId, trainerProfileId, ...dates }
        }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body.data.assignment, assignment);
    assert.deepEqual(insertedData, {
        org: orgId,
        requirement: requirementId,
        matchRun: matchRunId,
        trainer: profile.user,
        trainerProfile: trainerProfileId,
        assignedBy: userId,
        status: "assigned",
        ...dates
    });
});

test("trainer assignment controller returns details and lifecycle updates", async (t) => {
    const orgId = id();
    const assignmentId = id();
    const profileId = id();
    const assignment = { _id: assignmentId, trainerProfile: profileId, status: "in_progress" };
    t.mock.method(mongoose, "startSession", async () => session());
    t.mock.method(TrainerAssignment, "findOne", () => query(assignment));
    t.mock.method(TrainerAssignment, "findOneAndUpdate", () => Promise.resolve(assignment));
    t.mock.method(TrainerProfile, "findOneAndUpdate", () => Promise.resolve({ _id: profileId }));
    const req = {
        user: { orgId },
        validated: { params: { id: assignmentId }, body: { cancellationReason: "Rescheduled" } }
    };

    const detailResponse = await invoke(getTrainerAssignmentDetailsHandler, req);
    const startResponse = await invoke(startTrainerAssignmentHandler, req);
    const completeResponse = await invoke(completeTrainerAssignmentHandler, req);
    const cancelResponse = await invoke(cancelTrainerAssignmentHandler, req);

    for (const response of [detailResponse, startResponse, completeResponse, cancelResponse]) {
        assert.equal(response.status, 200);
        assert.deepEqual(response.body.data.assignment, assignment);
    }
});
