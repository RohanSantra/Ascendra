
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
    createSkillSchema,
    updateSkillSchema,
    skillIdParamsSchema,
    skillListQuerySchema
} from "./skill.validation.js";

import {
    createSkillHandler,
    listSkillsHandler,
    getSkillHandler,
    updateSkillHandler,
    archiveSkillHandler
} from "./skill.controller.js";

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
 * @description Creates a new skill for the organization.
 * @access Admin
 */
router.post(
    "/",
    ...adminOnly,
    validateRequest(createSkillSchema, {
        body: true
    }),
    createSkillHandler
);

/**
 * @route GET /
 * @description Retrieves organization skills with pagination,
 * search, and optional competency and category filters.
 * @access Admin
 */
router.get(
    "/",
    ...adminOnly,
    validateRequest(skillListQuerySchema, {
        query: true
    }),
    listSkillsHandler
);

/**
 * @route GET /:id
 * @description Retrieves a skill by its ID.
 * @access Admin
 */
router.get(
    "/:id",
    ...adminOnly,
    validateRequest(skillIdParamsSchema, {
        params: true
    }),
    getSkillHandler
);

/**
 * @route PATCH /:id
 * @description Updates skill information and competency associations.
 * @access Admin
 */
router.patch(
    "/:id",
    ...adminOnly,
    validateRequest(updateSkillSchema, {
        body: true,
        params: true
    }),
    updateSkillHandler
);

/**
 * @route PATCH /:id/archive
 * @description Archives a skill without permanently deleting it.
 * @access Admin
 */
router.patch(
    "/:id/archive",
    ...adminOnly,
    validateRequest(skillIdParamsSchema, {
        params: true
    }),
    archiveSkillHandler
);

export default router;
