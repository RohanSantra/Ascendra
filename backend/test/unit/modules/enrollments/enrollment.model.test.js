import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Enrollment from "../../../../src/modules/enrollments/enrollment.model.js";


const createEnrollment = (overrides = {}) => new Enrollment({
    org: new mongoose.Types.ObjectId(),
    course: new mongoose.Types.ObjectId(),
    trainee: new mongoose.Types.ObjectId(),
    ...overrides
});


test("defaults new enrollments and initializes lifecycle timestamps", async () => {
    const enrollment = createEnrollment();

    assert.equal(enrollment.status, "enrolled");
    assert.ok(enrollment.enrolledAt instanceof Date);
    assert.equal(enrollment.startedAt, null);
    assert.equal(enrollment.completedAt, null);
    assert.equal(enrollment.withdrawnAt, null);
    assert.equal(enrollment.cancelledAt, null);
    await enrollment.validate();
});


test("requires the organisation, course and trainee references", async () => {
    const enrollment = new Enrollment({
        status: "enrolled"
    });

    await assert.rejects(
        enrollment.validate(),
        (error) => Boolean(
            error.errors.org &&
            error.errors.course &&
            error.errors.trainee
        )
    );
});


test("prevents duplicate enrollments for a trainee and course", () => {
    const uniqueIndex = Enrollment.schema.indexes().find(
        ([keys]) => keys.org === 1 &&
            keys.course === 1 &&
            keys.trainee === 1
    );

    assert.equal(uniqueIndex[1].unique, true);
    assert.equal(
        uniqueIndex[1].name,
        "enrollment_org_course_trainee_unique"
    );
});
