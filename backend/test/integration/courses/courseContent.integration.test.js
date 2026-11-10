import test, {
    after,
    before
} from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-course-content";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-course-content";

import {
    clearTestDatabase,
    startTestDatabase,
    stopTestDatabase
} from "../../helpers/database.js";
import Course from "../../../src/modules/courses/course.model.js";
import CourseMaterial from "../../../src/modules/courseMaterials/courseMaterial.model.js";
import Enrollment from "../../../src/modules/enrollments/enrollment.model.js";
import {
    createCourse,
    getCourseByTrainerAssignment
} from "../../../src/modules/courses/course.repository.js";
import {
    createCourseMaterial,
    getCourseMaterialById
} from "../../../src/modules/courseMaterials/courseMaterial.repository.js";
import {
    createEnrollment,
    getEnrollmentByCourseAndTrainee,
    updateEnrollment
} from "../../../src/modules/enrollments/enrollment.repository.js";


before(async () => {
    await startTestDatabase();
    await Promise.all([
        Course.init(),
        CourseMaterial.init(),
        Enrollment.init()
    ]);
});


after(async () => {
    await stopTestDatabase();
});


test("persists a course, its material, and a trainee enrollment through repositories", async () => {
    await clearTestDatabase();

    const org = new mongoose.Types.ObjectId();
    const trainer = new mongoose.Types.ObjectId();
    const trainerProfile = new mongoose.Types.ObjectId();
    const assignment = new mongoose.Types.ObjectId();
    const requirement = new mongoose.Types.ObjectId();
    const trainee = new mongoose.Types.ObjectId();
    const courseData = {
        org,
        title: "Workplace Safety",
        trainer,
        trainerProfile,
        trainerAssignment: assignment,
        requirement,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
        status: "published",
        createdBy: trainer
    };

    const course = await createCourse(courseData);
    const foundCourse = await getCourseByTrainerAssignment({
        orgId: org,
        trainerAssignmentId: assignment
    });

    assert.equal(String(foundCourse._id), String(course._id));
    assert.equal(foundCourse.status, "published");

    const material = await createCourseMaterial({
        org,
        course: course._id,
        title: "Safety handout",
        materialType: "pdf",
        file: {
            originalName: "handout.pdf",
            storageProvider: "cloudinary",
            storageKey: "raw:materials/handout.pdf",
            resourceType: "raw",
            mimeType: "application/pdf",
            size: 1024
        },
        uploadedBy: trainer
    });
    const foundMaterial = await getCourseMaterialById({
        orgId: org,
        courseId: course._id,
        materialId: material._id
    });

    assert.equal(String(foundMaterial.course), String(course._id));
    assert.equal(foundMaterial.file.mimeType, "application/pdf");

    const enrollment = await createEnrollment({
        org,
        course: course._id,
        trainee
    });
    const foundEnrollment = await getEnrollmentByCourseAndTrainee({
        orgId: org,
        courseId: course._id,
        traineeId: trainee
    });
    const updatedEnrollment = await updateEnrollment({
        orgId: org,
        enrollmentId: enrollment._id,
        expectedStatus: "enrolled",
        updates: { status: "in_progress" }
    });

    assert.equal(String(foundEnrollment._id), String(enrollment._id));
    assert.equal(updatedEnrollment.status, "in_progress");
    assert.equal(await Enrollment.countDocuments({ org, course: course._id }), 1);
});
