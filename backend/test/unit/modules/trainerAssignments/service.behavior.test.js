import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import MatchRun from "../../../../src/modules/matchRun/matchRun.model.js";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import TrainingRequirement from "../../../../src/modules/trainingRequirements/trainingRequirement.model.js";
import TrainerAssignment from "../../../../src/modules/trainerAssignments/trainerAssignment.model.js";
import TrainerProfile from "../../../../src/modules/trainerProfiles/trainerProfile.model.js";
import {
    createTrainerAssignment
} from "../../../../src/modules/trainerAssignments/trainerAssignment.service.js";
import {
    getTrainerAssignmentDetails,
    startTrainerAssignment,
    completeTrainerAssignment
} from "../../../../src/modules/trainerAssignments/trainerAssignment.service.js";

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

const configureAssignmentCreation = (t, state) => {
    t.mock.method(mongoose, "startSession", async () => createSession());
    t.mock.method(TrainingRequirement, "findOne", () => createQuery(state.requirement));
    t.mock.method(MatchRun, "findOne", () => createQuery(state.matchRun));
    t.mock.method(TrainerProfile, "findOne", () => createQuery(state.profile));
    t.mock.method(OrganizationMembership, "findOne", () => createQuery(state.membership));
    t.mock.method(TrainerAssignment, "findOne", () => createQuery(state.existing));
    t.mock.method(TrainerProfile, "findOneAndUpdate", () => Promise.resolve(state.reserved));
    t.mock.method(TrainerAssignment, "create", async ([data]) => {
        if (state.createError) {
            throw state.createError;
        }
        state.createdData = data;
        return [state.assignment];
    });
    t.mock.method(TrainingRequirement, "findOneAndUpdate", () => Promise.resolve(state.updatedRequirement));
};

test("assignment service rejects an unavailable requirement before creating records", async (t) => {
    const orgId = id();
    const requirementId = id();
    t.mock.method(mongoose, "startSession", async () => createSession());
    t.mock.method(TrainingRequirement, "findOne", () => createQuery(null));

    await assert.rejects(
        () => createTrainerAssignment({
            orgId,
            requirementId,
            matchRunId: id(),
            trainerProfileId: id(),
            assignedBy: id(),
            startDate: new Date("2026-01-01"),
            endDate: new Date("2026-01-02")
        }),
        (error) => {
            assert.equal(error.statusCode, 404);
            assert.equal(error.code, "RESOURCE_NOT_FOUND");
            return true;
        }
    );
});

test("assignment service validates the matching workflow and handles duplicate races", async (t) => {
    const orgId = id();
    const requirementId = id();
    const matchRunId = id();
    const trainerProfileId = id();
    const trainerId = id();
    const state = {
        requirement: { _id: requirementId },
        matchRun: { requirement: requirementId, results: [{ trainerProfile: trainerProfileId }] },
        profile: { _id: trainerProfileId, user: trainerId },
        membership: { _id: id() },
        existing: null,
        reserved: { _id: trainerProfileId },
        assignment: { _id: id(), status: "assigned" },
        updatedRequirement: { _id: requirementId }
    };
    configureAssignmentCreation(t, state);
    const input = {
        orgId, requirementId, matchRunId, trainerProfileId,
        assignedBy: id(), startDate: new Date("2026-02-01"),
        endDate: new Date("2026-02-02")
    };

    state.requirement = null;
    await assert.rejects(() => createTrainerAssignment(input), (error) => error.statusCode === 404);
    state.requirement = { _id: requirementId };
    state.matchRun = null;
    await assert.rejects(() => createTrainerAssignment(input), (error) => error.statusCode === 404);
    state.matchRun = { requirement: id(), results: [] };
    await assert.rejects(() => createTrainerAssignment(input), (error) => error.statusCode === 400);
    state.matchRun = { requirement: requirementId, results: [] };
    await assert.rejects(() => createTrainerAssignment(input), (error) => error.statusCode === 400);
    state.matchRun.results = [{ trainerProfile: trainerProfileId }];
    state.profile = null;
    await assert.rejects(() => createTrainerAssignment(input), (error) => error.statusCode === 404);
    state.profile = { _id: trainerProfileId, user: trainerId };
    state.membership = null;
    await assert.rejects(() => createTrainerAssignment(input), (error) => error.statusCode === 403);
    state.membership = { _id: id() };
    state.existing = { _id: id() };
    await assert.rejects(() => createTrainerAssignment(input), (error) => error.statusCode === 409);
    state.existing = null;
    state.reserved = null;
    await assert.rejects(() => createTrainerAssignment(input), (error) => error.statusCode === 409);
    state.reserved = { _id: trainerProfileId };
    state.updatedRequirement = null;
    await assert.rejects(() => createTrainerAssignment(input), (error) => error.statusCode === 409);

    state.updatedRequirement = { _id: requirementId };
    state.createError = { code: 11000 };
    await assert.rejects(
        () => createTrainerAssignment(input),
        (error) => error.statusCode === 409 && error.code === "RESOURCE_CONFLICT"
    );
    state.createError = null;
    const result = await createTrainerAssignment(input);
    assert.equal(result, state.assignment);
    assert.equal(state.createdData.trainer, trainerId);
    assert.equal(state.createdData.status, "assigned");
});

test("assignment lifecycle services report missing and invalid transitions", async (t) => {
    const orgId = id();
    const assignmentId = id();
    const assignment = { _id: assignmentId, trainerProfile: id(), status: "assigned" };
    let existing = null;
    let transitioned = null;
    let capacity = null;
    t.mock.method(mongoose, "startSession", async () => createSession());
    t.mock.method(TrainerAssignment, "findOne", () => createQuery(existing));
    t.mock.method(TrainerAssignment, "findOneAndUpdate", () => Promise.resolve(transitioned));
    t.mock.method(TrainerProfile, "findOneAndUpdate", () => Promise.resolve(capacity));

    await assert.rejects(
        () => getTrainerAssignmentDetails({ orgId, assignmentId }),
        (error) => error.statusCode === 404
    );
    await assert.rejects(
        () => startTrainerAssignment({ orgId, assignmentId }),
        (error) => error.statusCode === 404
    );

    existing = assignment;
    await assert.rejects(
        () => completeTrainerAssignment({ orgId, assignmentId }),
        (error) => error.statusCode === 409
    );
    transitioned = { ...assignment, status: "completed" };
    await assert.rejects(
        () => completeTrainerAssignment({ orgId, assignmentId }),
        (error) => error.statusCode === 409
    );
    capacity = { _id: assignment.trainerProfile };
    assert.equal(
        (await completeTrainerAssignment({ orgId, assignmentId })).status,
        "completed"
    );
});
