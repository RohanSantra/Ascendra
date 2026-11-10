import test from "node:test";
import assert from "node:assert/strict";

import {
    createEvidenceSchema,
    evidenceListQuerySchema,
    rejectEvidenceSchema
} from "../../../src/modules/competencyEvidence/submissions/competencyEvidence.validation.js";


const validQualification = () => ({
    body: {
        type: "qualification",
        title: "  Software degree  ",
        details: {
            qualificationName: "Software degree",
            institution: "Example University"
        }
    }
});


test("applies safe defaults and trims submitted evidence fields", () => {
    const result = createEvidenceSchema.parse(validQualification());

    assert.equal(result.body.title, "Software degree");
    assert.deepEqual(result.body.competencies, []);
    assert.deepEqual(result.body.skills, []);
    assert.deepEqual(result.body.details, {
        qualificationName: "Software degree",
        institution: "Example University"
    });
});


test("rejects details for another evidence type and client-owned fields", () => {
    const unrelatedDetails = validQualification();
    unrelatedDetails.body.details.issuer = "Unexpected issuer";

    assert.equal(
        createEvidenceSchema.safeParse(unrelatedDetails).success,
        false
    );

    const clientOwnedField = validQualification();
    clientOwnedField.body.org = "507f1f77bcf86cd799439011";

    assert.equal(
        createEvidenceSchema.safeParse(clientOwnedField).success,
        false
    );
});


test("rejects inconsistent experience dates and assessment scores", () => {
    const invalidExperience = {
        body: {
            type: "experience",
            title: "Engineering role",
            details: {
                organizationName: "Example",
                designation: "Engineer",
                startDate: "2025-01-01",
                endDate: "2024-01-01",
                isOngoing: false
            }
        }
    };

    const invalidAssessment = {
        body: {
            type: "assessment",
            title: "Assessment result",
            details: {
                assessmentName: "Skills test",
                score: 11,
                maximumScore: 10,
                takenAt: "2025-01-01"
            }
        }
    };

    assert.equal(
        createEvidenceSchema.safeParse(invalidExperience).success,
        false
    );
    assert.equal(
        createEvidenceSchema.safeParse(invalidAssessment).success,
        false
    );
});


test("coerces evidence listing pagination and validates rejection reasons", () => {
    const query = evidenceListQuerySchema.parse({
        query: {
            page: "2",
            limit: "15"
        }
    });

    assert.deepEqual(query.query, {
        page: 2,
        limit: 15,
        verificationStatus: "all"
    });

    assert.equal(
        rejectEvidenceSchema.safeParse({
            params: {
                id: "507f1f77bcf86cd799439011"
            },
            body: {
                reason: "  No supporting record  "
            }
        }).data.body.reason,
        "No supporting record"
    );

    assert.equal(
        rejectEvidenceSchema.safeParse({
            params: {
                id: "507f1f77bcf86cd799439011"
            },
            body: {
                reason: "ok"
            }
        }).success,
        false
    );
});
