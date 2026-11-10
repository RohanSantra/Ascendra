import test, {
    before,
    beforeEach,
    after
} from "node:test";
import assert from "node:assert/strict";

import {
    clearTestDatabase,
    startTestDatabase,
    stopTestDatabase
} from "../../helpers/database.js";

import Organization from "../../../src/modules/organizations/organization.model.js";
import User from "../../../src/modules/auth/user.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";

import {
    getPlatformDashboard
} from "../../../src/modules/dashboards/platformAdmin/platformDashboard.service.js";
import {
    getOrganizationDashboard
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.service.js";
import {
    getOrganizationActivityReport
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.reporting.service.js";
import {
    getAssessmentPerformanceReport
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.performance.service.js";
import {
    getCoursePerformanceReport
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.coursePerformance.service.js";
import {
    getOrganizationMatchingReport
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.matching.service.js";
import {
    getOrganizationEvidenceReport
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.evidence.service.js";
import {
    getOrganizationRequirementReport
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.requirement.service.js";
import {
    getOrganizationTrainerPerformanceReport
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.trainerPerformance.service.js";
import {
    getOrganizationLearningReport
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.learning.service.js";
import {
    getOrganizationMembershipReport
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.membership.service.js";
import {
    getOrganizationFeedbackReport
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.feedback.service.js";
import {
    getOrganizationAnnouncementReport
} from "../../../src/modules/dashboards/organizationAdmin/services/organizationDashboard.announcement.service.js";

import {
    getPlatformDashboardController
} from "../../../src/modules/dashboards/platformAdmin/platformDashboard.controller.js";
import {
    getOrganizationDashboardController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.controller.js";
import {
    getOrganizationActivityReportController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.reporting.controller.js";
import {
    getAssessmentPerformanceReportController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.performance.controller.js";
import {
    getCoursePerformanceReportController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.coursePerformance.controller.js";
import {
    getOrganizationMatchingReportController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.matching.controller.js";
import {
    getOrganizationEvidenceReportController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.evidence.controller.js";
import {
    getOrganizationRequirementReportController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.requirement.controller.js";
import {
    getOrganizationTrainerPerformanceReportController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.trainerPerformance.controller.js";
import {
    getOrganizationLearningReportController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.learning.controller.js";
import {
    getOrganizationMembershipReportController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.membership.controller.js";
import {
    getOrganizationFeedbackReportController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.feedback.controller.js";
import {
    getOrganizationAnnouncementReportController
} from "../../../src/modules/dashboards/organizationAdmin/controllers/organizationDashboard.announcement.controller.js";

const orgId = "656e2a35f9e1d420acc90101";
const periodMonths = 1;

const reports = [
    getOrganizationActivityReport,
    getAssessmentPerformanceReport,
    getCoursePerformanceReport,
    getOrganizationMatchingReport,
    getOrganizationEvidenceReport,
    getOrganizationRequirementReport,
    getOrganizationTrainerPerformanceReport,
    getOrganizationLearningReport,
    getOrganizationMembershipReport,
    getOrganizationFeedbackReport,
    getOrganizationAnnouncementReport
];

const controllers = [
    [getOrganizationActivityReportController, true],
    [getAssessmentPerformanceReportController, true],
    [getCoursePerformanceReportController, true],
    [getOrganizationMatchingReportController, true],
    [getOrganizationEvidenceReportController, true],
    [getOrganizationRequirementReportController, true],
    [getOrganizationTrainerPerformanceReportController, true],
    [getOrganizationLearningReportController, true],
    [getOrganizationMembershipReportController, true],
    [getOrganizationFeedbackReportController, true],
    [getOrganizationAnnouncementReportController, true],
    [getOrganizationDashboardController, false],
    [getPlatformDashboardController, false]
];

const invokeController = (controller, req) => new Promise((resolve, reject) => {
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

    controller(req, res, reject);
});

before(async () => {
    await startTestDatabase();
});

beforeEach(async () => {
    await clearTestDatabase();
});

after(async () => {
    await stopTestDatabase();
});

test("platform dashboard service aggregates empty platform collections and normalizes categories", async () => {
    const dashboard = await getPlatformDashboard({ periodMonths });

    assert.equal(dashboard.period.months, periodMonths);
    assert.equal(dashboard.organizations.lifecycle.active, 0);
    assert.equal(dashboard.users.status.active, 0);
    assert.equal(dashboard.memberships.roles.admin.approved, 0);
    assert.ok(Array.isArray(dashboard.registrationTrends.organizations));
    assert.ok(Array.isArray(dashboard.registrationTrends.users));
    assert.equal(dashboard.generatedAt instanceof Date, true);
});

test("platform dashboard service counts organizations, users, and membership role/status pairs", async () => {
    const [admin, member] = await User.create([
        {
            firstName: "Ari",
            lastName: "Admin",
            email: "ari.admin@example.test",
            platformRole: "platform_admin",
            status: "active"
        },
        {
            firstName: "Toni",
            lastName: "Member",
            email: "toni.member@example.test",
            status: "suspended"
        }
    ]);
    const organization = await Organization.create({
        name: "North Shore",
        slug: "north-shore",
        status: "active",
        createdBy: admin._id
    });

    await OrganizationMembership.create([
        {
            org: organization._id,
            user: admin._id,
            role: "trainer",
            status: "approved"
        },
        {
            org: organization._id,
            user: member._id,
            role: "trainee",
            status: "pending"
        }
    ]);

    const dashboard = await getPlatformDashboard({ periodMonths });

    assert.deepEqual(dashboard.overview, {
        totalOrganizations: 1,
        totalUsers: 2,
        totalMemberships: 2,
        totalPlatformAdmins: 1
    });
    assert.equal(dashboard.organizations.lifecycle.active, 1);
    assert.equal(dashboard.users.status.suspended, 1);
    assert.equal(dashboard.users.platformRoles.platform_admin, 1);
    assert.equal(dashboard.memberships.roles.trainer.approved, 1);
    assert.equal(dashboard.memberships.roles.trainee.pending, 1);
});

test("platform dashboard service rejects invalid reporting periods", async () => {
    for (const invalidPeriod of [0, 25, 1.5, "12"]) {
        await assert.rejects(
            getPlatformDashboard({ periodMonths: invalidPeriod }),
            /between 1 and 24 months/
        );
    }
});

test("organization dashboard overview aggregates empty organization collections", async () => {
    const dashboard = await getOrganizationDashboard({ orgId });

    assert.equal(dashboard.memberships.total, 0);
    assert.equal(dashboard.memberships.byRoleAndStatus.admin.approved, 0);
    assert.equal(dashboard.generatedAt instanceof Date, true);
});

test("organization report services return organization-scoped results for an empty organization", async () => {
    const endDate = new Date();
    const startDate = new Date(
        Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth() - periodMonths + 1,
            1
        )
    );

    for (const [index, getReport] of reports.entries()) {
        const options = index < 9
            ? { orgId, periodMonths }
            : { orgId, startDate, endDate };
        const report = await getReport(options);

        assert.equal(typeof report, "object");
        assert.equal(report === null, false);
    }
});

test("organization report services reject missing organizations and invalid periods", async () => {
    for (const getReport of reports.slice(0, 9)) {
        await assert.rejects(getReport({ periodMonths }), {
            name: "AppError"
        });
        await assert.rejects(getReport({ orgId, periodMonths: 25 }), {
            name: "AppError"
        });
    }
});

test("dashboard controllers return successful API responses for their reports", async () => {
    for (const [controller, isOrganizationReport] of controllers) {
        const req = isOrganizationReport
            ? {
                user: { orgId },
                validated: { query: { periodMonths } }
            }
            : controller === getPlatformDashboardController
                ? { validated: { query: { periodMonths } } }
                : { user: { orgId } };

        const { statusCode, body } = await invokeController(controller, req);

        assert.equal(statusCode, 200);
        assert.equal(body.success, true);
        assert.ok(body.data);
    }
});
