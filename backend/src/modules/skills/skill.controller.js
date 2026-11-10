
import ApiResponse from "../../core/responses/ApiResponse.js";

import asyncHandler from "../../core/utils/asyncHandler.js";

import {
    createSkill,
    listSkills,
    getSkillById,
    updateSkill,
    archiveSkill
} from "./skill.service.js";

/**
 * @name createSkillHandler
 * @description Creates a new skill for the organization.
 * @access Admin
 */
export const createSkillHandler = asyncHandler(
    async (req, res) => {
        const skill = await createSkill({
            orgId: req.user.orgId,
            adminId: req.user.userId,
            data: req.validated.body
        });

        return ApiResponse.created(
            res,
            "Skill created successfully.",
            skill
        );
    }
);

/**
 * @name listSkillsHandler
 * @description Retrieves organization skills with pagination
 * and optional search and filtering.
 * @access Admin
 */
export const listSkillsHandler = asyncHandler(
    async (req, res) => {
        const result = await listSkills({
            orgId: req.user.orgId,
            ...req.validated.query
        });

        return ApiResponse.ok(
            res,
            "Skills retrieved successfully.",
            result.items,
            {
                pagination: result.pagination
            }
        );
    }
);

/**
 * @name getSkillHandler
 * @description Retrieves a skill by its ID.
 * @access Admin
 */
export const getSkillHandler = asyncHandler(
    async (req, res) => {
        const skill = await getSkillById({
            skillId: req.validated.params.id,
            orgId: req.user.orgId
        });

        return ApiResponse.ok(
            res,
            "Skill retrieved successfully.",
            skill
        );
    }
);

/**
 * @name updateSkillHandler
 * @description Updates an existing organization skill.
 * @access Admin
 */
export const updateSkillHandler = asyncHandler(
    async (req, res) => {
        const skill = await updateSkill({
            skillId: req.validated.params.id,
            orgId: req.user.orgId,
            adminId: req.user.userId,
            data: req.validated.body
        });

        return ApiResponse.ok(
            res,
            "Skill updated successfully.",
            skill
        );
    }
);

/**
 * @name archiveSkillHandler
 * @description Archives a skill without permanently deleting it.
 * @access Admin
 */
export const archiveSkillHandler = asyncHandler(
    async (req, res) => {
        const skill = await archiveSkill({
            skillId: req.validated.params.id,
            orgId: req.user.orgId,
            adminId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Skill archived successfully.",
            skill
        );
    }
);
