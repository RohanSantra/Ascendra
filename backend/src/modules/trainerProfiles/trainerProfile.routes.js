import { Router } from "express";

import validateRequest from "../../middleware/validate.middleware.js";

import { authenticate } from "../auth/auth.middleware.js";

import {
    loadOrganizationMembership,
    authorizeRoles
} from "../auth/authorization.middleware.js";

import {
    updateTrainerProfessionalDetailsSchema,
    updateTrainerAvailabilitySchema
} from "./trainerProfile.validation.js";

import {
    getMyTrainerProfileHandler,
    updateMyTrainerProfessionalDetailsHandler,
    updateMyTrainerAvailabilityHandler
} from "./trainerProfile.controller.js";

const router = Router();

/**
 * Trainers must have an approved membership in the selected organization.
 */
const trainerOnly = [
    authenticate,
    loadOrganizationMembership,
    authorizeRoles("trainer")
];

/**
 * @route GET /api/v1/trainer-profiles/me
 * @description Retrieves the authenticated trainer's profile.
 * @access Trainer
 */
router.get(
    "/me",
    ...trainerOnly,
    getMyTrainerProfileHandler
);

/**
 * @route PATCH /api/v1/trainer-profiles/me/professional-details
 * @description Updates trainer professional information.
 * @access Trainer
 */
router.patch(
    "/me/professional-details",
    ...trainerOnly,
    validateRequest(updateTrainerProfessionalDetailsSchema, {
        body: true
    }),
    updateMyTrainerProfessionalDetailsHandler
);


/**
 * @route PATCH /api/v1/trainer-profiles/me/availability
 * @description Updates trainer availability preferences.
 * @access Trainer
 */
router.patch(
    "/me/availability",
    ...trainerOnly,
    validateRequest(updateTrainerAvailabilitySchema, {
        body: true
    }),
    updateMyTrainerAvailabilityHandler
);

export default router;
