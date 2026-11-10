import mongoose from "mongoose";
import test from "node:test";
import assert from "node:assert/strict";

import {
    getTrainingRequirementForMatching,
    getActiveMatchingConfig,
    getEligibleTrainerProfiles,
    getTrainerEvidenceForMatching,
    createMatchRun,
    updateRequirementAfterMatching,
    getMatchRuns,
    getMatchRunById
} from "../../../src/modules/matching/matching.repository.js";

import TrainingRequirement from "../../../src/modules/trainingRequirements/trainingRequirement.model.js";
import MatchingConfig from "../../../src/modules/matchingConfig/matchingConfig.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../src/modules/trainerProfiles/trainerProfile.model.js";
import CompetencyEvidence from "../../../src/modules/competencyEvidence/submissions/competencyEvidence.model.js";
import MatchRun from "../../../src/modules/matchRun/matchRun.model.js";

const createQuery = (result) => {
    const calls = {};

    const query = {
        select(value) {
            calls.select = value;
            return this;
        },
        sort(value) {
            calls.sort = value;
            return this;
        },
        skip(value) {
            calls.skip = value;
            return this;
        },
        limit(value) {
            calls.limit = value;
            return this;
        },
        session(value) {
            calls.session = value;
            return this;
        },
        lean() {
            calls.lean = true;
            return this;
        },
        then(resolve, reject) {
            return Promise.resolve(result).then(resolve, reject);
        }
    };

    return { query, calls };
};

test("retrieves an eligible training requirement", async (t) => {
    const requirement = { _id: "requirement-1", status: "ready" };
    const { query, calls } = createQuery(requirement);
    let filter;

    t.mock.method(TrainingRequirement, "findOne", (value) => {
        filter = value;
        return query;
    });

    const result = await getTrainingRequirementForMatching({
        orgId: "org-1",
        requirementId: "requirement-1"
    });

    assert.equal(result, requirement);
    assert.deepEqual(filter, {
        _id: "requirement-1",
        org: "org-1",
        status: { $in: ["ready", "matched"] }
    });
    assert.equal(calls.session, null);
    assert.equal(calls.lean, true);
});

test("rejects a missing or ineligible training requirement", async (t) => {
    const { query } = createQuery(null);

    t.mock.method(TrainingRequirement, "findOne", () => query);

    await assert.rejects(
        getTrainingRequirementForMatching({
            orgId: "org-1",
            requirementId: "missing"
        }),
        {
            statusCode: 404,
            message: "Training requirement not found or is not ready for matching."
        }
    );
});

test("retrieves the active organisation matching configuration", async (t) => {
    const config = { org: "org-1", isActive: true };
    const { query, calls } = createQuery(config);
    let filter;

    t.mock.method(MatchingConfig, "findOne", (value) => {
        filter = value;
        return query;
    });

    const result = await getActiveMatchingConfig({
        orgId: "org-1"
    });

    assert.equal(result, config);
    assert.deepEqual(filter, {
        org: "org-1",
        isActive: true
    });
    assert.equal(calls.session, null);
    assert.equal(calls.lean, true);
});

test("rejects when no active matching configuration exists", async (t) => {
    const { query } = createQuery(null);

    t.mock.method(MatchingConfig, "findOne", () => query);

    await assert.rejects(
        getActiveMatchingConfig({ orgId: "org-1" }),
        {
            statusCode: 404,
            message: "Active matching configuration not found."
        }
    );
});

test("returns an empty array when no approved trainer memberships exist", async (t) => {
    const { query, calls } = createQuery([]);

    t.mock.method(OrganizationMembership, "find", () => query);

    const result = await getEligibleTrainerProfiles({
        orgId: "org-1"
    });

    assert.deepEqual(result, []);
    assert.equal(calls.lean, true);
    assert.deepEqual(calls.select, "_id user");
});

test("retrieves eligible trainer profiles for approved memberships", async (t) => {
    const memberships = [
        { user: "user-1" },
        { user: "user-2" }
    ];

    const profiles = [
        { _id: "profile-1", user: "user-1" },
        { _id: "profile-2", user: "user-2" }
    ];

    const membershipQuery = createQuery(memberships);
    const profileQuery = createQuery(profiles);

    let membershipFilter;
    let profileFilter;

    t.mock.method(OrganizationMembership, "find", (filter) => {
        membershipFilter = filter;
        return membershipQuery.query;
    });

    t.mock.method(TrainerProfile, "find", (filter) => {
        profileFilter = filter;
        return profileQuery.query;
    });

    const result = await getEligibleTrainerProfiles({
        orgId: "org-1"
    });

    assert.deepEqual(result, profiles);

    assert.deepEqual(membershipFilter, {
        org: "org-1",
        role: "trainer",
        status: "approved"
    });

    assert.deepEqual(profileFilter, {
        org: "org-1",
        user: { $in: ["user-1", "user-2"] },
        "approval.status": "approved",
        "availability.status": {
            $nin: ["unavailable", "on_leave"]
        }
    });

    assert.deepEqual(profileQuery.calls.sort, { _id: 1 });
});

test("returns an empty array when trainer profile IDs are omitted", async (t) => {
    t.mock.method(CompetencyEvidence, "find", () => {
        assert.fail("Evidence query should not execute");
    });

    assert.deepEqual(
        await getTrainerEvidenceForMatching({
            orgId: "org-1",
            trainerProfileIds: []
        }),
        []
    );

    assert.deepEqual(
        await getTrainerEvidenceForMatching({
            orgId: "org-1"
        }),
        []
    );
});

test("retrieves eligible evidence for the supplied trainer profiles", async (t) => {
    const evidence = [
        { _id: "evidence-1" },
        { _id: "evidence-2" }
    ];

    const { query, calls } = createQuery(evidence);
    let filter;

    t.mock.method(CompetencyEvidence, "find", (value) => {
        filter = value;
        return query;
    });

    const result = await getTrainerEvidenceForMatching({
        orgId: "org-1",
        trainerProfileIds: ["profile-1", "profile-2"]
    });

    assert.deepEqual(result, evidence);

    assert.deepEqual(filter, {
        org: "org-1",
        trainerProfile: {
            $in: ["profile-1", "profile-2"]
        },
        isDeleted: false,
        supersededBy: null,
        "verification.status": {
            $in: ["verified", "self_reported"]
        }
    });

    assert.equal(calls.lean, true);
    assert.deepEqual(calls.sort, {
        trainerProfile: 1,
        _id: 1
    });
});

test("creates and saves a match run", async (t) => {
    let savedOptions;

    t.mock.method(
        MatchRun.prototype,
        "save",
        async function (options) {
            savedOptions = options;
            return this;
        }
    );

    const orgId = new mongoose.Types.ObjectId();
    const requirementId = new mongoose.Types.ObjectId();

    const matchRunData = {
        org: orgId,
        requirement: requirementId,
        requirementSnapshot: {},
        configSnapshot: {},
        algorithmVersion: "1.0.0",
        outcome: "none_suitable",
        executedBy: new mongoose.Types.ObjectId()
    };

    const result = await createMatchRun({ matchRunData });

    assert.ok(result instanceof MatchRun);
    assert.equal(result.org.toString(), orgId.toString());
    assert.equal(result.requirement.toString(), requirementId.toString());
    assert.deepEqual(savedOptions, {});
});

test("updates a requirement after matching", async (t) => {
    const updatedRequirement = {
        _id: "requirement-1",
        status: "matched"
    };

    let capturedFilter;
    let capturedUpdate;
    let capturedOptions;

    t.mock.method(
        TrainingRequirement,
        "findOneAndUpdate",
        async (filter, update, options) => {
            capturedFilter = filter;
            capturedUpdate = update;
            capturedOptions = options;
            return updatedRequirement;
        }
    );

    const result = await updateRequirementAfterMatching({
        orgId: "org-1",
        requirementId: "requirement-1",
        matchRunId: "run-1",
        updatedBy: "admin-1"
    });

    assert.equal(result, updatedRequirement);

    assert.deepEqual(capturedFilter, {
        _id: "requirement-1",
        org: "org-1",
        status: { $in: ["ready", "matched"] }
    });

    assert.deepEqual(capturedUpdate, {
        $set: {
            latestMatchRun: "run-1",
            status: "matched",
            updatedBy: "admin-1"
        }
    });
    assert.deepEqual(capturedOptions, {
        returnDocument: "after",
        runValidators: true,
        session: undefined
    });

});

test("rejects when a requirement cannot be updated after matching", async (t) => {
    t.mock.method(
        TrainingRequirement,
        "findOneAndUpdate",
        async () => null
    );

    await assert.rejects(
        updateRequirementAfterMatching({
            orgId: "org-1",
            requirementId: "requirement-1",
            matchRunId: "run-1",
            updatedBy: "admin-1"
        }),
        {
            statusCode: 409,
            message: "Training requirement could not be updated after matching."
        }
    );
});

test("returns paginated match run history", async (t) => {
    const matchRuns = [{ _id: "run-1" }];
    const { query, calls } = createQuery(matchRuns);

    let capturedFilter;

    t.mock.method(MatchRun, "find", (filter) => {
        capturedFilter = filter;
        return query;
    });

    t.mock.method(
        MatchRun,
        "countDocuments",
        async () => 41
    );

    const result = await getMatchRuns({
        orgId: "org-1",
        page: 2,
        limit: 10
    });

    assert.deepEqual(result, {
        matchRuns,
        pagination: {
            page: 2,
            limit: 10,
            total: 41,
            totalPages: 5
        }
    });

    assert.deepEqual(capturedFilter, {
        org: "org-1"
    });

    assert.deepEqual(calls.sort, {
        createdAt: -1,
        _id: -1
    });

    assert.equal(calls.skip, 10);
    assert.equal(calls.limit, 10);
    assert.equal(calls.lean, true);
});

test("retrieves a match run within the selected organisation", async (t) => {
    const matchRun = { _id: "run-1", org: "org-1" };
    const { query } = createQuery(matchRun);

    let capturedFilter;

    t.mock.method(MatchRun, "findOne", (filter) => {
        capturedFilter = filter;
        return query;
    });

    const result = await getMatchRunById({
        orgId: "org-1",
        matchRunId: "run-1"
    });

    assert.equal(result, matchRun);
    assert.deepEqual(capturedFilter, {
        _id: "run-1",
        org: "org-1"
    });
});
