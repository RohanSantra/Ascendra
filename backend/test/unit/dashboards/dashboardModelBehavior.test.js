import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import * as platformRepository from "../../../src/modules/dashboards/platformAdmin/platformDashboard.repository.js";
import * as platformService from "../../../src/modules/dashboards/platformAdmin/platformDashboard.service.js";

import * as organizationRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.repository.js";
import * as announcementRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.announcement.repository.js";
import * as coursePerformanceRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.coursePerformance.repository.js";
import * as evidenceRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.evidence.repository.js";
import * as feedbackRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.feedback.repository.js";
import * as learningRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.learning.repository.js";
import * as matchingRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.matching.repository.js";
import * as membershipRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.membership.repository.js";
import * as performanceRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.performance.repository.js";
import * as reportingRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.reporting.repository.js";
import * as requirementRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.requirement.repository.js";
import * as trainerPerformanceRepository from "../../../src/modules/dashboards/organizationAdmin/repositories/organizationDashboard.trainerPerformance.repository.js";

import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../src/modules/trainerProfiles/trainerProfile.model.js";
import TrainingRequirement from "../../../src/modules/trainingRequirements/trainingRequirement.model.js";
import TrainerAssignment from "../../../src/modules/trainerAssignments/trainerAssignment.model.js";
import Course from "../../../src/modules/courses/course.model.js";
import CompetencyEvidence from "../../../src/modules/competencyEvidence/submissions/competencyEvidence.model.js";
import MatchRun from "../../../src/modules/matchRun/matchRun.model.js";
import Enrollment from "../../../src/modules/enrollments/enrollment.model.js";
import AssessmentAttempt from "../../../src/modules/assessments/assessmentAttempt.model.js";
import LearningProgress from "../../../src/modules/learningProgress/learningProgress.model.js";

import * as organizationService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.service.js";
import * as announcementService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.announcement.service.js";
import * as coursePerformanceService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.coursePerformance.service.js";
import * as evidenceService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.evidence.service.js";
import * as feedbackService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.feedback.service.js";
import * as learningService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.learning.service.js";
import * as matchingService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.matching.service.js";
import * as membershipService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.membership.service.js";
import * as performanceService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.performance.service.js";
import * as reportingService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.reporting.service.js";
import * as requirementService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.requirement.service.js";
import * as trainerPerformanceService from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.trainerPerformance.service.js";

const repositories = [
    platformRepository,
    organizationRepository,
    announcementRepository,
    coursePerformanceRepository,
    evidenceRepository,
    feedbackRepository,
    learningRepository,
    matchingRepository,
    membershipRepository,
    performanceRepository,
    reportingRepository,
    requirementRepository,
    trainerPerformanceRepository
];

const services = [
    platformService,
    organizationService,
    announcementService,
    coursePerformanceService,
    evidenceService,
    feedbackService,
    learningService,
    matchingService,
    membershipService,
    performanceService,
    reportingService,
    requirementService,
    trainerPerformanceService
];

const orgId = new mongoose.Types.ObjectId().toString();
const startDate = new Date("2025-01-01T00:00:00.000Z");
const endDate = new Date("2025-04-01T00:00:00.000Z");

const repositoryOptions = (module, functionName) => {
    if (
        module === requirementRepository &&
        functionName === "getRequirementReportingStatuses"
    ) {
        return [];
    }

    if (
        module === organizationRepository &&
        functionName === "getOrganizationDashboardOverview"
    ) {
        return [{ orgId }];
    }

    if (module === platformRepository) {
        if (
            functionName === "getOrganizationRegistrationTrend" ||
            functionName === "getUserRegistrationTrend"
        ) {
            return [{ startDate, endDate }];
        }

        return [];
    }

    if (module === organizationRepository) {
        return [orgId];
    }

    return [{
        orgId,
        startDate,
        endDate,
        months: 3
    }];
};

const serviceOptions = (functionName) => {
    if (functionName === "getPlatformDashboard") {
        return [{ periodMonths: 3 }];
    }

    if (functionName === "getOrganizationDashboard") {
        return [{ orgId }];
    }

    if (
        functionName === "getOrganizationFeedbackReport" ||
        functionName === "getOrganizationAnnouncementReport"
    ) {
        return [{ orgId, startDate, endDate }];
    }

    return [{ orgId, periodMonths: 3 }];
};

const installModelMocks = (t, calls) => {
    const models = new Set(Object.values(mongoose.models));

    for (const model of models) {
        t.mock.method(model, "aggregate", function (pipeline) {
            calls.push({
                model: this.modelName,
                method: "aggregate",
                pipeline
            });
            return Promise.resolve([]);
        });

        t.mock.method(model, "countDocuments", function (filter) {
            calls.push({
                model: this.modelName,
                method: "countDocuments",
                filter
            });
            return Promise.resolve(0);
        });
    }
};

const getFunctions = (modules) => modules.flatMap((module) =>
    Object.entries(module)
        .filter(([, value]) => typeof value === "function")
        .map(([name, fn]) => ({ module, name, fn }))
);

test("dashboard repositories issue model queries through mocked aggregate/count methods", async (t) => {
    const calls = [];
    installModelMocks(t, calls);
    const functions = getFunctions(repositories);
    assert.equal(functions.length, 50);

    for (const { module, name, fn } of functions) {
        const result = await fn(...repositoryOptions(module, name));
        assert.notEqual(result, undefined, `${name} should return a value`);
    }

    assert.ok(calls.length > functions.length);
    assert.ok(calls.some(({ method }) => method === "aggregate"));
    assert.ok(calls.some(({ method }) => method === "countDocuments"));

    const assessmentMatch = calls
        .find((call) =>
            call.model === "AssessmentAttempt" &&
            call.method === "aggregate" &&
            call.pipeline[0].$match?.status === "evaluated"
        )
        .pipeline[0].$match;
    assert.ok(assessmentMatch.org.equals(new mongoose.Types.ObjectId(orgId)));
    assert.equal(assessmentMatch.status, "evaluated");
    assert.deepEqual(assessmentMatch.createdAt, {
        $gte: startDate,
        $lt: endDate
    });
    assert.deepEqual(assessmentMatch.totalMarks, { $gt: 0 });

    const assignmentMatches = calls
        .filter((call) =>
            call.model === "TrainerAssignment" &&
            call.method === "aggregate"
        )
        .map((call) => call.pipeline[0].$match);
    assert.ok(assignmentMatches.length > 0);
    assert.ok(assignmentMatches.some((match) =>
        match.org instanceof mongoose.Types.ObjectId &&
        match.org.equals(new mongoose.Types.ObjectId(orgId)) &&
        match.assignedAt?.$gte instanceof Date &&
        match.assignedAt.$lt instanceof Date
    ));

    const coursePerformanceMatch = calls
        .find((call) =>
            call.model === "Course" &&
            call.method === "aggregate" &&
            call.pipeline[0].$match?.createdAt
        )
        .pipeline[0].$match;
    assert.ok(coursePerformanceMatch.org instanceof mongoose.Types.ObjectId);
    assert.ok(coursePerformanceMatch.org.equals(new mongoose.Types.ObjectId(orgId)));
    assert.deepEqual(coursePerformanceMatch.createdAt, {
        $gte: startDate,
        $lt: endDate
    });
});

test("dashboard services aggregate mocked repository model results", async (t) => {
    const calls = [];
    installModelMocks(t, calls);
    const functions = getFunctions(services);
    assert.equal(functions.length, 13);

    for (const { name, fn } of functions) {
        const result = await fn(...serviceOptions(name));
        assert.equal(typeof result, "object", `${name} should return a report`);
        assert.notEqual(result, null, `${name} should return a report`);
        assert.ok(result.generatedAt instanceof Date, `${name} should timestamp the report`);

        if (result.period?.months !== undefined) {
            assert.equal(result.period.months, 3, `${name} should preserve the requested period`);
        }

        if (result.period?.startDate !== undefined) {
            assert.ok(result.period.startDate instanceof Date);
            assert.ok(result.period.endDate instanceof Date);
        }

        if (name === "getPlatformDashboard") {
            assert.equal(result.overview.totalOrganizations, 0);
            assert.equal(result.users.status.active, 0);
        }

        if (name === "getOrganizationDashboard") {
            assert.equal(result.overview.totalMemberships, 0);
            assert.equal(result.memberships.total, 0);
        }
    }

    assert.ok(calls.length > 0);
    assert.ok(calls.every(({ model }) => typeof model === "string"));
});

test("trainer performance service merges trainer-only records and calculates completion rates", async (t) => {
    const assignmentTrainerId = new mongoose.Types.ObjectId();
    const courseTrainerId = new mongoose.Types.ObjectId();
    let assignmentPipeline;
    let coursePipeline;

    t.mock.method(TrainerAssignment, "aggregate", (pipeline) => {
        assignmentPipeline = pipeline;
        return Promise.resolve([
            {
                trainerId: assignmentTrainerId,
                totalAssignments: 4,
                assigned: 1,
                inProgress: 1,
                completed: 2,
                cancelled: 0
            }
        ]);
    });

    t.mock.method(Course, "aggregate", (pipeline) => {
        coursePipeline = pipeline;
        return Promise.resolve([
            {
                trainerId: courseTrainerId,
                totalCourses: 1,
                totalEnrollments: 0,
                completedEnrollments: 0
            },
            {
                trainerId: assignmentTrainerId,
                totalCourses: 2,
                totalEnrollments: 5,
                completedEnrollments: 3
            }
        ]);
    });

    const report =
        await trainerPerformanceService.getOrganizationTrainerPerformanceReport({
            orgId,
            periodMonths: 3
        });

    assert.equal(report.trainers.length, 2);
    assert.equal(String(report.trainers[0].trainerId), String(assignmentTrainerId));
    assert.equal(report.trainers[0].assignmentCompletionRate, 50);
    assert.equal(report.trainers[0].enrollmentCompletionRate, 60);
    assert.equal(String(report.trainers[1].trainerId), String(courseTrainerId));
    assert.equal(report.trainers[1].totalAssignments, 0);
    assert.equal(report.trainers[1].assignmentCompletionRate, 0);
    assert.equal(report.trainers[1].enrollmentCompletionRate, 0);
    const { totalTrainers, ...overviewTotals } = report.overview;
    assert.equal(totalTrainers, report.trainers.length);
    assert.equal(totalTrainers, 2);
    assert.deepEqual(overviewTotals, {
        totalAssignments: 4,
        completedAssignments: 2,
        totalCourses: 3,
        totalEnrollments: 5,
        completedEnrollments: 3,
        assignmentCompletionRate: 50,
        enrollmentCompletionRate: 60
    });
    assert.ok(assignmentPipeline[0].$match.org.equals(new mongoose.Types.ObjectId(orgId)));
    assert.ok(coursePipeline[0].$match.org.equals(new mongoose.Types.ObjectId(orgId)));
});

test("trainer performance service validates input and maps repository context errors", async (t) => {
    await assert.rejects(
        trainerPerformanceService.getOrganizationTrainerPerformanceReport({}),
        { name: "AppError", code: "VALIDATION_ERROR" }
    );
    await assert.rejects(
        trainerPerformanceService.getOrganizationTrainerPerformanceReport({
            orgId,
            periodMonths: 25
        }),
        { name: "AppError", code: "VALIDATION_ERROR" }
    );

    await assert.rejects(
        trainerPerformanceService.getOrganizationTrainerPerformanceReport({
            orgId: "invalid-id",
            periodMonths: 3
        }),
        {
            name: "AppError",
            message: "A valid organisation reporting context is required."
        }
    );

    const databaseError = new Error("database unavailable");
    t.mock.method(TrainerAssignment, "aggregate", () =>
        Promise.reject(databaseError)
    );
    t.mock.method(Course, "aggregate", () => Promise.resolve([]));

    await assert.rejects(
        trainerPerformanceService.getOrganizationTrainerPerformanceReport({
            orgId,
            periodMonths: 3
        }),
        (error) => error === databaseError
    );
});

test("membership, requirement, and activity aggregators return meaningful scoped reports", async (t) => {
    const modelCalls = [];
    const trendRecord = (pipeline, additionalFields = {}) => ({
        period: pipeline[0].$match.createdAt.$gte.toISOString().slice(0, 7),
        count: 2,
        ...additionalFields
    });

    t.mock.method(OrganizationMembership, "aggregate", function (pipeline) {
        modelCalls.push({ model: "membership", pipeline });
        if (pipeline[0].$match.createdAt) {
            return Promise.resolve([
                trendRecord(pipeline, { role: "trainer", count: 3 })
            ]);
        }
        if (pipeline[1]?.$group?._id?.role) {
            return Promise.resolve([
                { role: "admin", status: "approved", count: 2 }
            ]);
        }
        return Promise.resolve([{ period: "2025-02", count: 2 }]);
    });
    t.mock.method(TrainerProfile, "aggregate", (pipeline) => {
        modelCalls.push({ model: "trainerProfile", pipeline });
        return pipeline[0].$match.createdAt
            ? Promise.resolve([trendRecord(pipeline)])
            : Promise.resolve([{ status: "approved", count: 1 }]);
    });
    t.mock.method(TrainingRequirement, "aggregate", (pipeline) => {
        modelCalls.push({ model: "requirement", pipeline });
        return pipeline[0].$match.createdAt
            ? Promise.resolve([trendRecord(pipeline, { count: 4 })])
            : Promise.resolve([{ status: "ready", count: 5 }]);
    });
    for (const [modelName, model] of [
        ["evidence", CompetencyEvidence],
        ["matching", MatchRun],
        ["assignment", TrainerAssignment],
        ["course", Course],
        ["enrollment", Enrollment],
        ["assessmentAttempt", AssessmentAttempt],
        ["learningProgress", LearningProgress]
    ]) {
        t.mock.method(model, "aggregate", (pipeline) => {
            modelCalls.push({ model: modelName, pipeline });
            return Promise.resolve([trendRecord(pipeline)]);
        });
    }

    const membership = await membershipService.getOrganizationMembershipReport({
        orgId,
        periodMonths: 2
    });
    assert.equal(membership.overview.totalMemberships, 2);
    assert.equal(membership.membershipDistribution.admin.approved, 2);
    assert.equal(membership.trainerApprovals.statuses.approved, 1);
    assert.ok(membership.registrationTrends.some((month) => month.trainer === 3));

    const requirements = await requirementService.getOrganizationRequirementReport({
        orgId,
        periodMonths: 2
    });
    assert.equal(requirements.statuses.ready, 5);
    assert.ok(requirements.creationTrends.some((month) => month.count === 4));
    assert.deepEqual(
        requirementRepository.getRequirementReportingStatuses(),
        ["draft", "ready", "matched", "assigned", "cancelled", "archived"]
    );

    const activity = await reportingService.getOrganizationActivityReport({
        orgId,
        periodMonths: 2
    });
    assert.equal(activity.activity.memberships.some((month) => month.count === 3), true);
    assert.equal(activity.activity.competencyEvidence.some((month) => month.count === 2), true);

    assert.equal(modelCalls.filter(({ model }) => model === "membership").length, 3);
    assert.ok(modelCalls
        .filter(({ model }) => model !== "membership")
        .every(({ pipeline }) => pipeline[0].$match.org instanceof mongoose.Types.ObjectId));

    assert.ok(modelCalls.length >= 15);
    const evidenceMatch = modelCalls.find(({ model }) =>
        model === "evidence"
    ).pipeline[0].$match;
    assert.ok(evidenceMatch.org.equals(new mongoose.Types.ObjectId(orgId)));
    assert.equal(evidenceMatch.isDeleted, false);
    assert.equal(evidenceMatch.supersededBy, null);
});
