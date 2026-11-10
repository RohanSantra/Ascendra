
import { Router } from "express";

import { authenticate } from "../auth/auth.middleware.js";
import { authorizePlatformAdmin } from "../auth/authorization.middleware.js";

import validateRequest from "../../middleware/validate.middleware.js";

import {
    discoverOrganizationsQuerySchema,
    pendingOrganizationApplicationsQuerySchema,
    createOrganizationApplicationSchema,
    organizationIdParamsSchema,
    rejectOrganizationApplicationSchema,
    suspendOrganizationSchema,
    reactivateOrganizationSchema,
} from "./organization.validation.js";

import {
    getDiscoverableOrganizations,
    submitOrganizationApplication,
    getPendingOrganizationApplications,
    approveOrganization,
    rejectOrganization,
    suspendOrganizationController,
    reactivateOrganizationController,
} from "./organization.controller.js";

const router = Router();

/**
 * Public organisation discovery.
 *
 * Only active organisations are returned.
 */
router.get(
    "/",
    validateRequest(discoverOrganizationsQuerySchema, {
        query: true,
    }),
    getDiscoverableOrganizations
);

/**
 * Submit a new organisation application.
 *
 * Any authenticated user can apply.
 * The applicant receives a pending admin membership.
 */
router.post(
    "/applications",
    authenticate,
    validateRequest(createOrganizationApplicationSchema, {
        body: true,
    }),
    submitOrganizationApplication
);

/**
 * Platform Administrator: list pending applications.
 */
router.get(
    "/applications/pending",
    authenticate,
    authorizePlatformAdmin,
    validateRequest(pendingOrganizationApplicationsQuerySchema, {
        query: true,
    }),
    getPendingOrganizationApplications
);

/**
 * Platform Administrator: approve an application.
 */
router.patch(
    "/applications/:id/approve",
    authenticate,
    authorizePlatformAdmin,
    validateRequest(organizationIdParamsSchema, {
        params: true,
    }),
    approveOrganization
);

/**
 * Platform Administrator: reject an application.
 */
router.patch(
    "/applications/:id/reject",
    authenticate,
    authorizePlatformAdmin,
    validateRequest(rejectOrganizationApplicationSchema, {
        params: true,
        body: true,
    }),
    rejectOrganization
);

/**
 * Platform Administrator: suspend an active organisation.
 */
router.patch(
    "/:id/suspend",
    authenticate,
    authorizePlatformAdmin,
    validateRequest(suspendOrganizationSchema, {
        params: true,
        body: true,
    }),
    suspendOrganizationController
);

/**
 * Platform Administrator: reactivate a suspended organisation.
 */
router.patch(
    "/:id/reactivate",
    authenticate,
    authorizePlatformAdmin,
    validateRequest(reactivateOrganizationSchema, {
        params: true,
        body: true,
    }),
    reactivateOrganizationController
);

export default router;
