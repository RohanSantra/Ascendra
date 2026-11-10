import {
    getMyTrainerProfile,
    updateMyTrainerProfessionalDetails,
    updateMyTrainerAvailability
} from "./trainerProfile.service.js";

import ApiResponse from "../../core/responses/ApiResponse.js";
import { asyncHandler } from "../../core/utils/index.js";

/**
 * @name getMyTrainerProfileHandler
 * @description Retrieves the authenticated trainer's profile.
 */
export const getMyTrainerProfileHandler = asyncHandler(
    async (req, res) => {
        const result = await getMyTrainerProfile({
            orgId: req.user.orgId,
            userId: req.user.userId
        });

        return ApiResponse.ok(
            res,
            "Trainer profile retrieved successfully.",
            { trainerProfile: result }
        );
    }
);

/**
 * @name updateMyTrainerProfessionalDetailsHandler
 * @description Updates the trainer's professional information.
 */
export const updateMyTrainerProfessionalDetailsHandler = asyncHandler(
    async (req, res) => {
        const result = await updateMyTrainerProfessionalDetails({
            orgId: req.user.orgId,
            userId: req.user.userId,
            data: req.validated.body
        });

        return ApiResponse.ok(
            res,
            "Trainer professional details updated successfully.",
            { trainerProfile: result }
        );
    }
);

/**
 * @name updateMyTrainerAvailabilityHandler
 * @description Updates the trainer's availability preferences.
 */
export const updateMyTrainerAvailabilityHandler = asyncHandler(
    async (req, res) => {
        const result = await updateMyTrainerAvailability({
            orgId: req.user.orgId,
            userId: req.user.userId,
            data: req.validated.body
        });

        return ApiResponse.ok(
            res,
            "Trainer availability updated successfully.",
            { trainerProfile: result }
        );
    }
);
