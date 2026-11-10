
import { Router } from "express";

import {
    authenticate
} from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import validateRequest from "../../middleware/validate.middleware.js";

import {
    createCompetencySchema,
    updateCompetencySchema,
    competencyIdParamsSchema,
    competencyListQuerySchema
} from "./competency.validation.js";

import {
    createCompetencyHandler,
    listCompetenciesHandler,
    getCompetencyHandler,
    updateCompetencyHandler,
    archiveCompetencyHandler
} from "./competency.controller.js";

const router = Router();

/**
 * @name adminOnly
 * @description Applies authentication, organization membership
 * validation, and administrator role authorization.
 */
const adminOnly = [
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("admin")
];

/**
 * @route POST /
 * @description Creates a new competency for the organization.
 * @access Admin
 */
router.post(
    "/",
    ...adminOnly,
    validateRequest(createCompetencySchema, {
        body: true
    }),
    createCompetencyHandler
);

/**
 * @route GET /
 * @description Retrieves the organization's competencies with
 * pagination and optional search and filtering.
 * @access Admin
 */
router.get(
    "/",
    ...adminOnly,
    validateRequest(competencyListQuerySchema, {
        query: true
    }),
    listCompetenciesHandler
);

/**
 * @route GET /:id
 * @description Retrieves a competency by its ID.
 * @access Admin
 */
router.get(
    "/:id",
    ...adminOnly,
    validateRequest(competencyIdParamsSchema, {
        params: true
    }),
    getCompetencyHandler
);

/**
 * @route PATCH /:id
 * @description Updates an existing competency.
 * @access Admin
 */
router.patch(
    "/:id",
    ...adminOnly,
    validateRequest(updateCompetencySchema, {
        body: true,
        params: true
    }),
    updateCompetencyHandler
);

/**
 * @route PATCH /:id/archive
 * @description Archives a competency without permanently
 * deleting its record.
 * @access Admin
 */
router.patch(
    "/:id/archive",
    ...adminOnly,
    validateRequest(competencyIdParamsSchema, {
        params: true
    }),
    archiveCompetencyHandler
);

export default router;
