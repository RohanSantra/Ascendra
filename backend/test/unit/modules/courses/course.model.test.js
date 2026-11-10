import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Course from "../../../../src/modules/courses/course.model.js";


const createCourse = (overrides = {}) => new Course({
    org: new mongoose.Types.ObjectId(),
    title: "  Safety Training  ",
    trainer: new mongoose.Types.ObjectId(),
    trainerProfile: new mongoose.Types.ObjectId(),
    trainerAssignment: new mongoose.Types.ObjectId(),
    requirement: new mongoose.Types.ObjectId(),
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-06-02"),
    createdBy: new mongoose.Types.ObjectId(),
    ...overrides
});


test("applies course defaults and trims text fields", async () => {
    const course = createCourse({
        description: "  Course details  "
    });

    assert.equal(course.title, "Safety Training");
    assert.equal(course.description, "Course details");
    assert.equal(course.status, "draft");
    await course.validate();
});


test("requires course ownership references and rejects unsupported statuses", async () => {
    const missingReferences = new Course({
        title: "Safety Training"
    });
    const invalidStatus = createCourse({
        status: "unlisted"
    });

    await assert.rejects(
        missingReferences.validate(),
        (error) => Boolean(
            error.errors.org &&
            error.errors.trainerAssignment
        )
    );
    await assert.rejects(
        invalidStatus.validate(),
        (error) => Boolean(error.errors.status)
    );
});


test("rejects an end date earlier than the start date", async () => {
    const course = createCourse({
        startDate: new Date("2026-06-03"),
        endDate: new Date("2026-06-02")
    });

    await assert.rejects(
        course.validate(),
        (error) => Boolean(error.errors.endDate)
    );
});


test("enforces one course per trainer assignment", () => {
    const uniqueIndex = Course.schema.indexes().find(
        ([keys]) => keys.trainerAssignment === 1
    );

    assert.deepEqual(uniqueIndex[0], { trainerAssignment: 1 });
    assert.equal(uniqueIndex[1].unique, true);
    assert.equal(
        uniqueIndex[1].name,
        "course_trainer_assignment_unique"
    );
});
