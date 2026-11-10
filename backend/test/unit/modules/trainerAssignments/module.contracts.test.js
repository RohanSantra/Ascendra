import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as assignmentValidation from "../../../../src/modules/trainerAssignments/trainerAssignment.validation.js";
import * as requirementValidation from "../../../../src/modules/trainingRequirements/trainingRequirement.validation.js";

const objectId = () => new mongoose.Types.ObjectId().toString();


test("assignment and requirement schemas validate dates and substantive requirements", () => {
    const id = objectId();
    const assignmentInput = {
        params: { requirementId: id },
        body: {
            matchRunId: id,
            trainerProfileId: id,
            startDate: "2026-01-02",
            endDate: "2026-01-03"
        }
    };

    assert.equal(assignmentValidation.createTrainerAssignmentSchema.safeParse(assignmentInput).success, true);
    assert.equal(
        assignmentValidation.createTrainerAssignmentSchema.safeParse({
            ...assignmentInput,
            body: { ...assignmentInput.body, endDate: "2026-01-01" }
        }).success,
        false
    );
    assert.deepEqual(
        assignmentValidation.listTrainerAssignmentsQuerySchema.parse({ query: {} }).query,
        { page: 1, limit: 20 }
    );
    assert.equal(
        requirementValidation.createTrainingRequirementSchema.safeParse({
            body: { title: "Need a trainer" }
        }).success,
        false
    );
    assert.equal(
        requirementValidation.createTrainingRequirementSchema.safeParse({
            body: { title: "Need a trainer", qualificationKeywords: ["teaching"] }
        }).success,
        true
    );
    assert.equal(
        requirementValidation.updateTrainingRequirementSchema.safeParse({
            params: { id },
            body: {}
        }).success,
        false
    );
});
