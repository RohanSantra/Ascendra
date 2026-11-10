import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    createEvidenceHandler,
    listMyEvidenceHandler,
    getMyEvidenceHandler,
    deleteMyEvidenceHandler
} from "../../../src/modules/competencyEvidence/submissions/competencyEvidence.controller.js";

import {
    listPendingEvidenceHandler,
    getPendingEvidenceHandler,
    approveEvidenceHandler,
    rejectEvidenceHandler
} from "../../../src/modules/competencyEvidence/verification/evidenceVerification.controller.js";

import CompetencyEvidence from "../../../src/modules/competencyEvidence/submissions/competencyEvidence.model.js";


const invoke = (handler, req) => new Promise((resolve) => {
    const res = {
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },

        json(body) {
            resolve({ statusCode: this.statusCode, body });
            return this;
        }
    };

    handler(req, res, (error) => resolve({ error }));
});


test("serves trainer and administrator evidence queues with pagination", async (t) => {
    const query = {
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        populate() { return this; },
        lean() { return Promise.resolve([]); }
    };

    t.mock.method(CompetencyEvidence, "find", () => query);
    t.mock.method(CompetencyEvidence, "countDocuments", async () => 0);

    const req = {
        user: {
            orgId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId()
        },
        validated: {
            query: {
                page: 1,
                limit: 20,
                verificationStatus: "all"
            }
        }
    };

    const trainerResult = await invoke(listMyEvidenceHandler, req);
    const adminResult = await invoke(listPendingEvidenceHandler, {
        ...req,
        validated: {
            query: {
                page: 1,
                limit: 20
            }
        }
    });

    assert.equal(trainerResult.statusCode, 200);
    assert.deepEqual(trainerResult.body.data, []);
    assert.equal(trainerResult.body.meta.pagination.total, 0);
    assert.equal(adminResult.statusCode, 200);
    assert.deepEqual(adminResult.body.data, []);
    assert.equal(adminResult.body.meta.pagination.total, 0);
});


test("forwards not-found errors for evidence detail handlers", async (t) => {
    t.mock.method(CompetencyEvidence, "findOne", () => ({
        session() { return this; },
        lean() { return Promise.resolve(null); }
    }));

    const req = {
        user: {
            orgId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId()
        },
        validated: {
            params: { id: new mongoose.Types.ObjectId() }
        }
    };

    const trainerResult = await invoke(getMyEvidenceHandler, req);
    const adminResult = await invoke(getPendingEvidenceHandler, req);

    assert.equal(trainerResult.error.statusCode, 404);
    assert.equal(adminResult.error.statusCode, 404);
});


test("returns successful responses for trainer and administrator evidence details", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const evidence = {
        _id: new mongoose.Types.ObjectId(),
        org: orgId,
        user: userId,
        trainerProfile: new mongoose.Types.ObjectId(),
        type: "certification",
        competencies: [],
        skills: [],
        title: "Course certificate",
        details: {},
        verification: {
            status: "self_reported",
            verifiedBy: null,
            verifiedAt: null,
            rejectionReason: null
        },
        isDeleted: false
    };

    t.mock.method(CompetencyEvidence, "findOne", () => ({
        session() { return this; },
        populate() { return this; },
        lean() { return Promise.resolve(evidence); }
    }));

    const req = {
        user: { orgId, userId },
        validated: {
            params: { id: evidence._id }
        }
    };
    const trainerResult = await invoke(getMyEvidenceHandler, req);
    const adminResult = await invoke(getPendingEvidenceHandler, req);

    assert.equal(trainerResult.statusCode, 200);
    assert.equal(trainerResult.body.data.id, evidence._id.toString());
    assert.equal(adminResult.statusCode, 200);
    assert.equal(adminResult.body.data.id, evidence._id.toString());
});


test("forwards transaction failures from evidence submission and review handlers", async (t) => {
    const transactionError = new Error("Transaction unavailable");
    t.mock.method(mongoose, "startSession", async () => {
        throw transactionError;
    });

    const req = {
        user: {
            orgId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId()
        },
        validated: {
            params: { id: new mongoose.Types.ObjectId() },
            body: {
                type: "qualification",
                competencies: [],
                skills: [],
                title: "Qualification",
                details: {}
            },
            query: {}
        }
    };

    const results = await Promise.all([
        invoke(createEvidenceHandler, req),
        invoke(deleteMyEvidenceHandler, req),
        invoke(approveEvidenceHandler, req),
        invoke(rejectEvidenceHandler, {
            ...req,
            validated: {
                ...req.validated,
                body: { reason: "Insufficient evidence" }
            }
        })
    ]);

    for (const result of results) {
        assert.equal(result.error, transactionError);
    }
});
