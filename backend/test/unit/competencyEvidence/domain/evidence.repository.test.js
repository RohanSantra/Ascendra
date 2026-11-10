import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    getTrainerEvidenceForRecomputation,
    updateTrainerEvidenceSummary
} from "../../../../src/modules/competencyEvidence/domain/evidence.repository.js";

import CompetencyEvidence from "../../../../src/modules/competencyEvidence/submissions/competencyEvidence.model.js";
import TrainerProfile from "../../../../src/modules/trainerProfiles/trainerProfile.model.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../src/core/constants/index.js";


const createQuery = (result) => ({
    select() {
        return this;
    },

    sort() {
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


const createSummary = () => ({
    competencySummary: [
        {
            competency: new mongoose.Types.ObjectId(),
            level: "advanced"
        }
    ],
    skills: [
        {
            skill: new mongoose.Types.ObjectId(),
            level: "intermediate"
        }
    ],
    evidenceStats: {
        total: 5,
        verified: 3,
        selfReported: 2,
        rejected: 0
    },
    experience: {
        totalYears: 4
    },
    competencyRecomputedAt: new Date()
});


test("retrieves trainer evidence for recomputation", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const trainerProfileId = new mongoose.Types.ObjectId();
    const session = {};

    const evidence = [
        {
            _id: new mongoose.Types.ObjectId(),
            isDeleted: true
        },
        {
            _id: new mongoose.Types.ObjectId(),
            supersededBy: new mongoose.Types.ObjectId()
        }
    ];

    let capturedFilter;
    let capturedSession;

    t.mock.method(
        CompetencyEvidence,
        "find",
        (filter) => {
            capturedFilter = filter;

            const query = createQuery(evidence);

            const originalSession = query.session;

            query.session = function (value) {
                capturedSession = value;
                return originalSession.call(this, value);
            };

            return query;
        }
    );

    const result = await getTrainerEvidenceForRecomputation({
        orgId,
        trainerProfileId,
        session
    });

    assert.deepEqual(capturedFilter, {
        org: orgId,
        trainerProfile: trainerProfileId
    });

    assert.equal(capturedSession, session);
    assert.deepEqual(result, evidence);
});


test("retrieves trainer evidence without an optional session", async (t) => {
    let capturedSession;

    t.mock.method(
        CompetencyEvidence,
        "find",
        () => {
            const query = createQuery([]);

            const originalSession = query.session;

            query.session = function (value) {
                capturedSession = value;
                return originalSession.call(this, value);
            };

            return query;
        }
    );

    const result = await getTrainerEvidenceForRecomputation({
        orgId: new mongoose.Types.ObjectId(),
        trainerProfileId: new mongoose.Types.ObjectId()
    });

    assert.deepEqual(result, []);
    assert.equal(capturedSession, null);
});


test("throws not found when the trainer profile does not exist", async (t) => {
    t.mock.method(
        TrainerProfile,
        "findOne",
        () => createQuery(null)
    );

    await assert.rejects(
        () => updateTrainerEvidenceSummary({
            orgId: new mongoose.Types.ObjectId(),
            trainerProfileId: new mongoose.Types.ObjectId(),
            summary: createSummary()
        }),
        (error) => {
            assert.equal(error.statusCode, HTTP_STATUS.NOT_FOUND);
            assert.equal(error.code, ERROR_CODES.RESOURCE_NOT_FOUND);
            assert.equal(error.message, "Trainer profile not found.");

            return true;
        }
    );
});


test("updates only evidence-derived trainer profile fields", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const trainerProfileId = new mongoose.Types.ObjectId();
    const session = {};
    const summary = createSummary();

    let capturedFilter;
    let capturedSession;
    let capturedSet;
    let capturedSaveOptions;

    const profile = {
        set(values) {
            capturedSet = values;
        },

        async save(options) {
            capturedSaveOptions = options;
            return this;
        }
    };

    t.mock.method(
        TrainerProfile,
        "findOne",
        (filter) => {
            capturedFilter = filter;

            const query = createQuery(profile);

            const originalSession = query.session;

            query.session = function (value) {
                capturedSession = value;
                return originalSession.call(this, value);
            };

            return query;
        }
    );

    const result = await updateTrainerEvidenceSummary({
        orgId,
        trainerProfileId,
        summary,
        session
    });

    assert.deepEqual(capturedFilter, {
        _id: trainerProfileId,
        org: orgId
    });

    assert.equal(capturedSession, session);

    assert.deepEqual(capturedSet, {
        competencySummary: summary.competencySummary,
        skills: summary.skills,
        evidenceStats: summary.evidenceStats,
        experience: summary.experience,
        competencyRecomputedAt: summary.competencyRecomputedAt
    });

    assert.deepEqual(capturedSaveOptions, { session });
    assert.equal(result, profile);
});


test("converts optimistic concurrency errors into a conflict AppError", async (t) => {
    const profile = {
        set() {},

        async save() {
            const error = new Error("Document version changed");
            error.name = "VersionError";
            throw error;
        }
    };

    t.mock.method(
        TrainerProfile,
        "findOne",
        () => createQuery(profile)
    );

    await assert.rejects(
        () => updateTrainerEvidenceSummary({
            orgId: new mongoose.Types.ObjectId(),
            trainerProfileId: new mongoose.Types.ObjectId(),
            summary: createSummary()
        }),
        (error) => {
            assert.equal(error.statusCode, HTTP_STATUS.CONFLICT);
            assert.equal(error.code, ERROR_CODES.RESOURCE_CONFLICT);
            assert.match(error.message, /updated concurrently/i);

            return true;
        }
    );
});


test("rethrows non-version errors from profile save", async (t) => {
    const originalError = new Error("Database unavailable");

    const profile = {
        set() {},

        async save() {
            throw originalError;
        }
    };

    t.mock.method(
        TrainerProfile,
        "findOne",
        () => createQuery(profile)
    );

    await assert.rejects(
        () => updateTrainerEvidenceSummary({
            orgId: new mongoose.Types.ObjectId(),
            trainerProfileId: new mongoose.Types.ObjectId(),
            summary: createSummary()
        }),
        (error) => {
            assert.equal(error, originalError);
            return true;
        }
    );
});