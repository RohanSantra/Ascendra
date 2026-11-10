import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    createEvidence,
    listMyEvidence,
    getMyEvidenceById,
    deleteMyEvidence
} from "../../../src/modules/competencyEvidence/submissions/competencyEvidence.service.js";

import CompetencyEvidence from "../../../src/modules/competencyEvidence/submissions/competencyEvidence.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";

import {
    ERROR_CODES,
    HTTP_STATUS
} from "../../../src/core/constants/index.js";


const createQuery = (result) => {
    const query = {
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
            return this;
        },

        then(resolve, reject) {
            return Promise.resolve(result).then(resolve, reject);
        }
    };

    return query;
};


const createEvidenceRecord = () => {
    const org = new mongoose.Types.ObjectId();
    const user = new mongoose.Types.ObjectId();
    const trainerProfile = new mongoose.Types.ObjectId();
    const competency = new mongoose.Types.ObjectId();
    const skill = new mongoose.Types.ObjectId();

    return {
        _id: new mongoose.Types.ObjectId(),
        org,
        user,
        trainerProfile,

        type: "certification",

        competencies: [competency],
        skills: [skill],

        title: "JavaScript Certification",
        description: "Completed JavaScript certification.",
        details: {
            certificateName: "JavaScript Professional"
        },

        file: {
            originalName: "certificate.pdf",
            storageProvider: "cloudinary",
            storageKey: "private/certificate.pdf",
            mimeType: "application/pdf",
            size: 1024,
            uploadedAt: new Date()
        },

        verification: {
            status: "self_reported",
            verifiedBy: null,
            verifiedAt: null,
            rejectionReason: null
        },

        isDeleted: false,
        deletedAt: null,
        supersededBy: null,
        supersededAt: null,

        createdAt: new Date(),
        updatedAt: new Date()
    };
};


const assertAppError = async (
    operation,
    expectedStatus,
    expectedCode
) => {
    await assert.rejects(operation, (error) => {
        assert.equal(error.statusCode, expectedStatus);
        assert.equal(error.code, expectedCode);

        return true;
    });
};


test("lists evidence with pagination information", async (t) => {
    const evidence = createEvidenceRecord();

    t.mock.method(
        CompetencyEvidence,
        "find",
        () => createQuery([evidence])
    );

    t.mock.method(
        CompetencyEvidence,
        "countDocuments",
        async () => 1
    );

    const result = await listMyEvidence({
        orgId: evidence.org,
        userId: evidence.user,
        page: 1,
        limit: 10
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, evidence._id.toString());

    assert.deepEqual(result.pagination, {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
    });
});


test("applies type, verification and escaped search filters", async (t) => {
    const evidence = createEvidenceRecord();

    let capturedFilter;

    t.mock.method(
        CompetencyEvidence,
        "find",
        (filter) => {
            capturedFilter = filter;
            return createQuery([]);
        }
    );

    t.mock.method(
        CompetencyEvidence,
        "countDocuments",
        async () => 0
    );

    await listMyEvidence({
        orgId: evidence.org,
        userId: evidence.user,
        page: 2,
        limit: 5,
        type: "certification",
        verificationStatus: "rejected",
        search: "C++"
    });

    assert.equal(capturedFilter.org, evidence.org);
    assert.equal(capturedFilter.user, evidence.user);
    assert.equal(capturedFilter.isDeleted, false);
    assert.equal(capturedFilter.supersededBy, null);
    assert.equal(capturedFilter.type, "certification");
    assert.equal(
        capturedFilter["verification.status"],
        "rejected"
    );

    assert.ok(capturedFilter.$or);

    const titleRegex = capturedFilter.$or[0].title;

    assert.ok(titleRegex.test("C++ Certification"));
    assert.equal(titleRegex.test("Cxx Certification"), false);
});


test("does not add optional filters when they are omitted", async (t) => {
    const evidence = createEvidenceRecord();

    let capturedFilter;

    t.mock.method(
        CompetencyEvidence,
        "find",
        (filter) => {
            capturedFilter = filter;
            return createQuery([]);
        }
    );

    t.mock.method(
        CompetencyEvidence,
        "countDocuments",
        async () => 0
    );

    await listMyEvidence({
        orgId: evidence.org,
        userId: evidence.user,
        page: 1,
        limit: 10
    });

    assert.equal(capturedFilter.type, undefined);
    assert.equal(
        capturedFilter["verification.status"],
        undefined
    );
    assert.equal(capturedFilter.$or, undefined);
});


test("retrieves evidence belonging to the requested trainer and organization", async (t) => {
    const evidence = createEvidenceRecord();

    let capturedFilter;

    t.mock.method(
        CompetencyEvidence,
        "findOne",
        (filter) => {
            capturedFilter = filter;
            return createQuery(evidence);
        }
    );

    const result = await getMyEvidenceById({
        evidenceId: evidence._id,
        orgId: evidence.org,
        userId: evidence.user
    });

    assert.equal(capturedFilter._id, evidence._id);
    assert.equal(capturedFilter.org, evidence.org);
    assert.equal(capturedFilter.user, evidence.user);
    assert.equal(capturedFilter.isDeleted, false);

    assert.equal(result.id, evidence._id.toString());
    assert.equal(result.org, evidence.org.toString());
    assert.equal(result.user, evidence.user.toString());
    assert.equal(
        result.trainerProfile,
        evidence.trainerProfile.toString()
    );

    assert.equal(
        result.file.storageKey,
        undefined
    );
});


test("returns a not-found error when evidence does not exist", async (t) => {
    t.mock.method(
        CompetencyEvidence,
        "findOne",
        () => createQuery(null)
    );

    await assertAppError(
        () => getMyEvidenceById({
            evidenceId: new mongoose.Types.ObjectId(),
            orgId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId()
        }),
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
    );
});


test("requires an approved trainer membership before creating evidence", async (t) => {
    const session = {
        withTransaction: async (operation) => operation(session),
        endSession: async () => {}
    };

    t.mock.method(
        mongoose,
        "startSession",
        async () => session
    );

    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery(null)
    );

    await assertAppError(
        () => createEvidence({
            orgId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId(),
            data: {
                competencies: [],
                skills: [],
                type: "certification",
                title: "Certification"
            }
        }),
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.RESOURCE_ACCESS_DENIED
    );
});


test("returns a not-found error when evidence cannot be deleted", async (t) => {
    const session = {
        withTransaction: async (operation) => operation(session),
        endSession: async () => {}
    };

    t.mock.method(
        mongoose,
        "startSession",
        async () => session
    );

    t.mock.method(
        CompetencyEvidence,
        "findOne",
        () => createQuery(null)
    );

    await assertAppError(
        () => deleteMyEvidence({
            evidenceId: new mongoose.Types.ObjectId(),
            orgId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId()
        }),
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
    );
});


test("does not allow verified evidence to be deleted", async (t) => {
    const session = {
        withTransaction: async (operation) => operation(session),
        endSession: async () => {}
    };

    const evidence = createEvidenceRecord();

    evidence.verification.status = "verified";

    t.mock.method(
        mongoose,
        "startSession",
        async () => session
    );

    t.mock.method(
        CompetencyEvidence,
        "findOne",
        () => createQuery(evidence)
    );

    await assertAppError(
        () => deleteMyEvidence({
            evidenceId: evidence._id,
            orgId: evidence.org,
            userId: evidence.user
        }),
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.RESOURCE_CONFLICT
    );

    assert.equal(evidence.isDeleted, false);
});


test("serializes evidence without exposing private file storage metadata", async (t) => {
    const evidence = createEvidenceRecord();

    evidence.verification = {
        status: "rejected",
        verifiedBy: new mongoose.Types.ObjectId(),
        verifiedAt: new Date(),
        rejectionReason: "Invalid certificate"
    };

    evidence.supersededBy = new mongoose.Types.ObjectId();

    t.mock.method(
        CompetencyEvidence,
        "findOne",
        () => createQuery(evidence)
    );

    const result = await getMyEvidenceById({
        evidenceId: evidence._id,
        orgId: evidence.org,
        userId: evidence.user
    });

    assert.equal(
        result.verification.verifiedBy,
        evidence.verification.verifiedBy.toString()
    );

    assert.equal(
        result.supersededBy,
        evidence.supersededBy.toString()
    );

    assert.equal(result.file.storageKey, undefined);
    assert.equal(result.file.checksum, undefined);
});