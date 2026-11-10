import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as trainerProfileValidation from "../../../../src/modules/trainerProfiles/trainerProfile.validation.js";
import * as trainerApprovalValidation from "../../../../src/modules/trainerProfiles/trainerApproval.validation.js";

const objectId = () => new mongoose.Types.ObjectId().toString();


test("trainer profile and approval schemas enforce partial updates and pagination", () => {
    assert.equal(
        trainerProfileValidation.updateTrainerProfessionalDetailsSchema.safeParse({
            body: {}
        }).success,
        false
    );
    assert.deepEqual(
        trainerProfileValidation.updateTrainerAvailabilitySchema.parse({
            body: { status: "limited", maxConcurrentTrainings: 3 }
        }).body,
        { status: "limited", maxConcurrentTrainings: 3 }
    );
    assert.equal(
        trainerApprovalValidation.rejectTrainerApprovalSchema.safeParse({
            params: { id: objectId() },
            body: { reason: "x" }
        }).success,
        false
    );
    assert.deepEqual(
        trainerApprovalValidation.pendingTrainerApprovalQuerySchema.parse({ query: {} }).query,
        { page: 1, limit: 20 }
    );
});
