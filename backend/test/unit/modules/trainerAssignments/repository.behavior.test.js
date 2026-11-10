import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import TrainerAssignment from "../../../../src/modules/trainerAssignments/trainerAssignment.model.js";
import TrainerProfile from "../../../../src/modules/trainerProfiles/trainerProfile.model.js";
import TrainingRequirement from "../../../../src/modules/trainingRequirements/trainingRequirement.model.js";
import MatchRun from "../../../../src/modules/matchRun/matchRun.model.js";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import * as repository from "../../../../src/modules/trainerAssignments/trainerAssignment.repository.js";

const id = () => new mongoose.Types.ObjectId();

const query = (value) => ({
    populate() { return this; },
    sort(value) { this.sortValue = value; return this; },
    skip(value) { this.skipValue = value; return this; },
    limit(value) { this.limitValue = value; return this; },
    session(value) { this.sessionValue = value; return this; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test("assignment repository scopes lookups and applies capacity/lifecycle updates", async (t) => {
    const orgId = id();
    const requirementId = id();
    const matchRunId = id();
    const profileId = id();
    const userId = id();
    const assignmentId = id();
    const session = { id: "session" };
    const requirement = { _id: requirementId };
    const matchRun = { _id: matchRunId };
    const profile = { _id: profileId };
    const membership = { _id: id() };
    const assignment = { _id: assignmentId };
    const scopedFinds = [];
    const updates = [];

    t.mock.method(TrainingRequirement, "findOne", (filter) => {
        scopedFinds.push(filter);
        return query(requirement);
    });
    t.mock.method(MatchRun, "findOne", (filter) => {
        scopedFinds.push(filter);
        return query(matchRun);
    });
    t.mock.method(TrainerProfile, "findOne", (filter) => {
        scopedFinds.push(filter);
        return query(profile);
    });
    t.mock.method(OrganizationMembership, "findOne", (filter) => {
        scopedFinds.push(filter);
        return query(membership);
    });
    t.mock.method(TrainerProfile, "findOneAndUpdate", (filter, update, options) => {
        updates.push({ filter, update, options });
        return Promise.resolve(profile);
    });
    t.mock.method(TrainerAssignment, "create", async ([data], options) => {
        assert.deepEqual(options, { session });
        return [{ ...assignment, data }];
    });
    t.mock.method(TrainerAssignment, "findOne", (filter) => {
        scopedFinds.push(filter);
        return query(assignment);
    });
    t.mock.method(TrainerAssignment, "findOneAndUpdate", (filter, update, options) => {
        updates.push({ filter, update, options });
        return Promise.resolve(assignment);
    });
    t.mock.method(TrainingRequirement, "findOneAndUpdate", (filter, update, options) => {
        updates.push({ filter, update, options });
        return Promise.resolve(requirement);
    });

    assert.equal(await repository.getRequirementForAssignment({ orgId, requirementId, session }), requirement);
    assert.equal(await repository.getMatchRunForAssignment({ orgId, matchRunId, session }), matchRun);
    assert.equal(await repository.getTrainerProfileForAssignment({ orgId, trainerProfileId: profileId, session }), profile);
    assert.equal(await repository.getApprovedTrainerMembership({ orgId, userId, session }), membership);
    assert.equal(await repository.reserveTrainerCapacity({ orgId, trainerProfileId: profileId, session }), profile);
    assert.deepEqual(await repository.createTrainerAssignment({ assignmentData: { status: "assigned" }, session }), {
        ...assignment, data: { status: "assigned" }
    });
    assert.equal(await repository.getTrainerAssignmentById({ orgId, assignmentId }), assignment);
    assert.equal(await repository.getExistingTrainerAssignment({
        orgId, requirementId, trainerProfileId: profileId, session
    }), assignment);
    assert.equal(await repository.transitionTrainerAssignment({
        orgId, assignmentId, allowedStatuses: ["assigned"], status: "in_progress", session
    }), assignment);
    assert.equal(await repository.transitionTrainerAssignment({
        orgId, assignmentId, allowedStatuses: ["assigned", "in_progress"],
        status: "cancelled", cancellationReason: "  rescheduled  ", session
    }), assignment);
    await repository.transitionTrainerAssignment({
        orgId, assignmentId, allowedStatuses: ["assigned"], status: "cancelled"
    });
    await repository.transitionTrainerAssignment({
        orgId, assignmentId, allowedStatuses: ["in_progress"], status: "completed", session
    });
    assert.equal(await repository.releaseTrainerCapacity({ orgId, trainerProfileId: profileId, session }), profile);
    assert.equal(await repository.markRequirementAsAssigned({ orgId, requirementId, session }), requirement);

    assert.deepEqual(scopedFinds.slice(0, 4), [
        { _id: requirementId, org: orgId, status: { $in: ["matched", "assigned"] } },
        { _id: matchRunId, org: orgId },
        { _id: profileId, org: orgId, "approval.status": "approved" },
        { org: orgId, user: userId, role: "trainer", status: "approved" }
    ]);
    assert.deepEqual(updates[0].update, { $inc: { "availability.activeTrainings": 1 } });
    assert.equal(updates[1].update.$set.completedAt, null);
    assert.equal(updates[2].update.$set.cancellationReason, "rescheduled");
    assert.equal(updates[3].update.$set.cancellationReason, null);
    assert.ok(updates[4].update.$set.completedAt instanceof Date);
    assert.deepEqual(updates[5].filter["availability.activeTrainings"], { $gt: 0 });
    assert.deepEqual(updates[6].update, { $set: { status: "assigned" } });
});

test("assignment repository lists organization and trainer-scoped records", async (t) => {
    const orgId = id();
    const profileId = id();
    const assignment = { _id: id() };
    const filters = [];
    let findQuery;
    t.mock.method(TrainerAssignment, "find", (filter) => {
        filters.push(filter);
        findQuery = query([assignment]);
        return findQuery;
    });
    t.mock.method(TrainerAssignment, "countDocuments", async (filter) => {
        filters.push(filter);
        return 2;
    });

    const page = await repository.getTrainerAssignments({
        orgId, page: 2, limit: 1, status: "assigned", requirementId: id()
    });
    assert.deepEqual(page.assignments, [assignment]);
    assert.deepEqual(page.pagination, { page: 2, limit: 1, total: 2, totalPages: 2 });
    assert.equal(findQuery.skipValue, 1);
    assert.equal(findQuery.limitValue, 1);
    assert.deepEqual(filters[0], filters[1]);

    const byProfile = await repository.getTrainerAssignmentsByProfile({ orgId, trainerProfileId: profileId });
    assert.deepEqual(byProfile, [assignment]);
    assert.deepEqual(filters[2], { org: orgId, trainerProfile: profileId });

    const defaults = await repository.getTrainerAssignments({ orgId });
    assert.deepEqual(defaults.pagination, { page: 1, limit: 20, total: 2, totalPages: 1 });
    assert.deepEqual(filters[3], { org: orgId });
    assert.equal(findQuery.skipValue, 0);
    assert.equal(findQuery.limitValue, 20);
});
