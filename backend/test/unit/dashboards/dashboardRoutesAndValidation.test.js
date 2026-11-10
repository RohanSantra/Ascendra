import test from "node:test";
import assert from "node:assert/strict";

import platformDashboardRouter from "../../../src/modules/dashboards/platformAdmin/platformDashboard.routes.js";
import organizationDashboardRouter from "../../../src/modules/dashboards/organizationAdmin/routes/organizationDashboard.routes.js";
import organizationReportingRouter from "../../../src/modules/dashboards/organizationAdmin/routes/organizationDashboard.reporting.routes.js";

import {
    platformDashboardQuerySchema
} from "../../../src/modules/dashboards/platformAdmin/platformDashboard.validation.js";
import {
    organizationDashboardReportingQuerySchema
} from "../../../src/modules/dashboards/organizationAdmin/validations/organizationDashboard.reporting.validation.js";
import {
    organizationFeedbackReportQuerySchema
} from "../../../src/modules/dashboards/organizationAdmin/validations/organizationDashboard.feedback.validation.js";
import {
    organizationAnnouncementReportQuerySchema
} from "../../../src/modules/dashboards/organizationAdmin/validations/organizationDashboard.announcement.validation.js";

const querySchemas = [
    platformDashboardQuerySchema,
    organizationDashboardReportingQuerySchema,
    organizationFeedbackReportQuerySchema,
    organizationAnnouncementReportQuerySchema
];

const getRoutes = (router) => router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
        path: layer.route.path,
        methods: layer.route.methods,
        handlers: layer.route.stack.map((routeLayer) => routeLayer.handle)
    }));

test("dashboard query schemas coerce periods and apply their defaults", () => {
    for (const schema of querySchemas) {
        assert.deepEqual(
            schema.parse({ query: {} }),
            { query: { periodMonths: 12 } }
        );
        assert.deepEqual(
            schema.parse({ query: { periodMonths: "6" } }),
            { query: { periodMonths: 6 } }
        );
    }
});

test("dashboard query schemas reject out-of-range, fractional, and extra query values", () => {
    for (const schema of querySchemas) {
        for (const periodMonths of ["0", "25", "2.5", "invalid"]) {
            assert.equal(
                schema.safeParse({ query: { periodMonths } }).success,
                false
            );
        }

        assert.equal(
            schema.safeParse({
                query: { periodMonths: "3", unexpected: "value" }
            }).success,
            false
        );
    }
});

test("platform dashboard route is authenticated, authorized, validated, and handled", () => {
    const [route] = getRoutes(platformDashboardRouter);

    assert.equal(route.path, "/dashboard");
    assert.equal(route.methods.get, true);
    assert.equal(route.handlers.length, 4);
});

test("organization dashboard routes expose only GET reports through the expected middleware chain", () => {
    const routes = [
        ...getRoutes(organizationDashboardRouter),
        ...getRoutes(organizationReportingRouter)
    ];

    assert.deepEqual(
        routes.map((route) => route.path).sort(),
        [
            "/reports/activity",
            "/reports/activity",
            "/reports/announcements",
            "/reports/assessment-performance",
            "/reports/assessment-performance",
            "/reports/course-performance",
            "/reports/evidence",
            "/reports/feedback",
            "/reports/learning-progress",
            "/reports/matching",
            "/reports/memberships",
            "/reports/requirements",
            "/reports/trainer-performance"
        ].sort()
    );

    for (const route of routes) {
        assert.equal(route.methods.get, true);
        assert.equal(route.handlers.length, 5);
    }
});
