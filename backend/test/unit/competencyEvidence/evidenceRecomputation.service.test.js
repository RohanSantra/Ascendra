
import test from "node:test";
import assert from "node:assert/strict";

import {
    createEvidenceRecomputationService
} from "../../../src/modules/competencyEvidence/domain/evidenceRecomputation.service.js";

const ORG_ID = "organization-123";
const PROFILE_ID = "trainer-profile-123";

const NOW = new Date("2026-11-03T12:00:00.000Z");

const CONFIG = {
    halfLifeYears: 3,
    diminishingReturnFactor: 0.7,
    proficiencyThresholds: {
        intermediate: 3,
        advanced: 6,
        expert: 9
    }
};

const EVIDENCE_DOCUMENTS = [
    { _id: "evidence-1", type: "qualification" },
    { _id: "evidence-2", type: "certification" }
];

const ENGINE_RECORDS = [
    { id: "engine-evidence-1" },
    { id: "engine-evidence-2" }
];

const ENGINE_SUMMARY = {
    competencies: [],
    skills: [],
    evidenceStats: {},
    experience: {},
    generatedAt: NOW
};

const PROFILE_SUMMARY = {
    competencySummary: [],
    skills: [],
    evidenceStats: {
        total: 2,
        verified: 1,
        verifiedRatio: 0.5,
        latestEvidenceAt: NOW
    },
    experience: {
        industryYears: 2,
        teachingYears: 1
    },
    competencyRecomputedAt: NOW
};

const UPDATED_PROFILE = {
    _id: PROFILE_ID,
    org: ORG_ID,
    competencySummary: [],
    skills: []
};

const createDependencies = (overrides = {}) => {
    const calls = [];

    const dependencies = {
        getEvidence: async (params) => {
            calls.push({ step: "getEvidence", params });
            return EVIDENCE_DOCUMENTS;
        },

        mapEvidence: (documents) => {
            calls.push({ step: "mapEvidence", documents });
            return ENGINE_RECORDS;
        },

        calculateSummary: (params) => {
            calls.push({ step: "calculateSummary", params });
            return ENGINE_SUMMARY;
        },

        mapProfile: (summary, config) => {
            calls.push({ step: "mapProfile", summary, config });
            return PROFILE_SUMMARY;
        },

        updateSummary: async (params) => {
            calls.push({ step: "updateSummary", params });
            return UPDATED_PROFILE;
        },

        ...overrides
    };

    return { dependencies, calls };
};

test("recomputes and persists a trainer evidence summary", async () => {
    const { dependencies } = createDependencies();

    const recompute = createEvidenceRecomputationService(dependencies);

    const result = await recompute({
        orgId: ORG_ID,
        trainerProfileId: PROFILE_ID,
        now: NOW,
        config: CONFIG
    });

    assert.equal(result, UPDATED_PROFILE);
});

test("retrieves evidence using the organization and trainer profile IDs", async () => {
    const { dependencies, calls } = createDependencies();

    const recompute = createEvidenceRecomputationService(dependencies);

    await recompute({
        orgId: ORG_ID,
        trainerProfileId: PROFILE_ID,
        now: NOW,
        config: CONFIG
    });

    assert.deepEqual(calls[0], {
        step: "getEvidence",
        params: {
            orgId: ORG_ID,
            trainerProfileId: PROFILE_ID
        }
    });
});

test("maps retrieved evidence documents into engine input", async () => {
    const { dependencies, calls } = createDependencies();

    const recompute = createEvidenceRecomputationService(dependencies);

    await recompute({
        orgId: ORG_ID,
        trainerProfileId: PROFILE_ID,
        now: NOW,
        config: CONFIG
    });

    assert.equal(calls[1].step, "mapEvidence");
    assert.equal(calls[1].documents, EVIDENCE_DOCUMENTS);
});

test("passes mapped evidence, date and configuration to the engine", async () => {
    const { dependencies, calls } = createDependencies();

    const recompute = createEvidenceRecomputationService(dependencies);

    await recompute({
        orgId: ORG_ID,
        trainerProfileId: PROFILE_ID,
        now: NOW,
        config: CONFIG
    });

    assert.deepEqual(calls[2], {
        step: "calculateSummary",
        params: {
            evidenceRecords: ENGINE_RECORDS,
            now: NOW,
            config: CONFIG
        }
    });
});

test("maps the engine summary into trainer profile fields", async () => {
    const { dependencies, calls } = createDependencies();

    const recompute = createEvidenceRecomputationService(dependencies);

    await recompute({
        orgId: ORG_ID,
        trainerProfileId: PROFILE_ID,
        now: NOW,
        config: CONFIG
    });

    assert.deepEqual(calls[3], {
        step: "mapProfile",
        summary: ENGINE_SUMMARY,
        config: CONFIG
    });
});

test("persists the mapped trainer profile summary", async () => {
    const { dependencies, calls } = createDependencies();

    const recompute = createEvidenceRecomputationService(dependencies);

    await recompute({
        orgId: ORG_ID,
        trainerProfileId: PROFILE_ID,
        now: NOW,
        config: CONFIG
    });

    assert.deepEqual(calls[4], {
        step: "updateSummary",
        params: {
            orgId: ORG_ID,
            trainerProfileId: PROFILE_ID,
            summary: PROFILE_SUMMARY
        }
    });
});

test("executes workflow steps in the correct order", async () => {
    const { dependencies, calls } = createDependencies();

    const recompute = createEvidenceRecomputationService(dependencies);

    await recompute({
        orgId: ORG_ID,
        trainerProfileId: PROFILE_ID,
        now: NOW,
        config: CONFIG
    });

    assert.deepEqual(
        calls.map((call) => call.step),
        [
            "getEvidence",
            "mapEvidence",
            "calculateSummary",
            "mapProfile",
            "updateSummary"
        ]
    );
});

test("does not continue when evidence retrieval fails", async () => {
    const retrievalError = new Error("Database retrieval failed");

    const { dependencies, calls } = createDependencies({
        getEvidence: async () => {
            calls.push({ step: "getEvidence" });
            throw retrievalError;
        }
    });

    const recompute = createEvidenceRecomputationService(dependencies);

    await assert.rejects(
        recompute({
            orgId: ORG_ID,
            trainerProfileId: PROFILE_ID,
            now: NOW,
            config: CONFIG
        }),
        (error) => error === retrievalError
    );

    assert.deepEqual(
        calls.map((call) => call.step),
        ["getEvidence"]
    );
});

test("does not persist when summary calculation fails", async () => {
    const calculationError = new Error("Calculation failed");

    const { dependencies, calls } = createDependencies({
        calculateSummary: () => {
            calls.push({ step: "calculateSummary" });
            throw calculationError;
        }
    });

    const recompute = createEvidenceRecomputationService(dependencies);

    await assert.rejects(
        recompute({
            orgId: ORG_ID,
            trainerProfileId: PROFILE_ID,
            now: NOW,
            config: CONFIG
        }),
        (error) => error === calculationError
    );

    assert.deepEqual(
        calls.map((call) => call.step),
        [
            "getEvidence",
            "mapEvidence",
            "calculateSummary"
        ]
    );
});

test("propagates profile update errors", async () => {
    const updateError = new Error("Profile update failed");

    const { dependencies } = createDependencies({
        updateSummary: async () => {
            throw updateError;
        }
    });

    const recompute = createEvidenceRecomputationService(dependencies);

    await assert.rejects(
        recompute({
            orgId: ORG_ID,
            trainerProfileId: PROFILE_ID,
            now: NOW,
            config: CONFIG
        }),
        (error) => error === updateError
    );
});
