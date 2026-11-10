
import mongoose from "mongoose";

import {
    getRequirementForAssignment,
    getMatchRunForAssignment,
    getTrainerProfileForAssignment,
    getApprovedTrainerMembership,
    reserveTrainerCapacity,
    createTrainerAssignment as insertTrainerAssignment,
    getExistingTrainerAssignment,
    markRequirementAsAssigned,
    getTrainerAssignments,
    getTrainerAssignmentById,
    transitionTrainerAssignment,
    releaseTrainerCapacity
} from "./trainerAssignment.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";

/**
 * @name createAssignmentError
 * @description Creates a standardized trainer assignment error.
 *
 * @param {string} message
 * @param {number} statusCode
 * @param {string} code
 * @returns {AppError}
 */
const createAssignmentError = (message, statusCode, code) => {
    return new AppError(
        message,
        statusCode,
        code
    );
};

/**
 * @name createTrainerAssignment
 * @description Assigns an approved trainer to a matched
 * training requirement.
 *
 * Assignment creation, capacity reservation and requirement
 * status update are performed in one transaction.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.requirementId
 * @param {string} params.matchRunId
 * @param {string} params.trainerProfileId
 * @param {string} params.assignedBy
 * @param {Date} params.startDate
 * @param {Date} params.endDate
 * @returns {Promise<Object>}
 */
export const createTrainerAssignment = async ({
    orgId,
    requirementId,
    matchRunId,
    trainerProfileId,
    assignedBy,
    startDate,
    endDate
}) => {
    const session = await mongoose.startSession();

    try {
        const assignment = await session.withTransaction(
            async () => {
                const requirement = await getRequirementForAssignment({
                    orgId,
                    requirementId,
                    session
                });

                if (!requirement) {
                    throw createAssignmentError(
                        "Training requirement was not found or is not available for assignment.",
                        HTTP_STATUS.NOT_FOUND,
                        ERROR_CODES.RESOURCE_NOT_FOUND
                    );
                }

                const matchRun = await getMatchRunForAssignment({
                    orgId,
                    matchRunId,
                    session
                });

                if (!matchRun) {
                    throw createAssignmentError(
                        "Matching run was not found.",
                        HTTP_STATUS.NOT_FOUND,
                        ERROR_CODES.RESOURCE_NOT_FOUND
                    );
                }

                if (
                    String(matchRun.requirement) !==
                    String(requirementId)
                ) {
                    throw createAssignmentError(
                        "The selected matching run does not belong to this training requirement.",
                        HTTP_STATUS.BAD_REQUEST,
                        ERROR_CODES.VALIDATION_ERROR
                    );
                }

                const matchingResult = Array.isArray(matchRun.results)
                    ? matchRun.results.find(
                        (result) =>
                            String(result.trainerProfile) ===
                            String(trainerProfileId)
                    )
                    : null;

                if (!matchingResult) {
                    throw createAssignmentError(
                        "The selected trainer was not included in the matching run results.",
                        HTTP_STATUS.BAD_REQUEST,
                        ERROR_CODES.VALIDATION_ERROR
                    );
                }

                const trainerProfile = await getTrainerProfileForAssignment({
                    orgId,
                    trainerProfileId,
                    session
                });

                if (!trainerProfile) {
                    throw createAssignmentError(
                        "Approved trainer profile was not found.",
                        HTTP_STATUS.NOT_FOUND,
                        ERROR_CODES.RESOURCE_NOT_FOUND
                    );
                }

                const trainerMembership = await getApprovedTrainerMembership({
                    orgId,
                    userId: trainerProfile.user,
                    session
                });

                if (!trainerMembership) {
                    throw createAssignmentError(
                        "The trainer does not have an approved membership in this organization.",
                        HTTP_STATUS.FORBIDDEN,
                        ERROR_CODES.FORBIDDEN
                    );
                }

                const existingAssignment = await getExistingTrainerAssignment({
                    orgId,
                    requirementId,
                    trainerProfileId,
                    session
                });

                if (existingAssignment) {
                    throw createAssignmentError(
                        "This trainer has already been assigned to the selected requirement.",
                        HTTP_STATUS.CONFLICT,
                        ERROR_CODES.RESOURCE_CONFLICT
                    );
                }

                const reservedProfile = await reserveTrainerCapacity({
                    orgId,
                    trainerProfileId,
                    session
                });

                if (!reservedProfile) {
                    throw createAssignmentError(
                        "The trainer has no available training capacity.",
                        HTTP_STATUS.CONFLICT,
                        ERROR_CODES.RESOURCE_CONFLICT
                    );
                }

                const createdAssignment = await insertTrainerAssignment({
                    assignmentData: {
                        org: orgId,
                        requirement: requirementId,
                        matchRun: matchRunId,
                        trainer: trainerProfile.user,
                        trainerProfile: trainerProfileId,
                        assignedBy,
                        status: "assigned",
                        startDate,
                        endDate
                    },
                    session
                });

                const updatedRequirement = await markRequirementAsAssigned({
                    orgId,
                    requirementId,
                    session
                });

                if (!updatedRequirement) {
                    throw createAssignmentError(
                        "The training requirement could not be updated after assignment.",
                        HTTP_STATUS.CONFLICT,
                        ERROR_CODES.RESOURCE_CONFLICT
                    );
                }

                return createdAssignment;
            }
        );

        return assignment;
    } catch (error) {
        /**
         * Handles concurrent duplicate assignment requests.
         *
         * The repository performs a duplicate check before insertion,
         * but concurrent requests can still reach the unique index
         * simultaneously. MongoDB rejects the second insertion.
         */
        if (error?.code === 11000) {
            throw createAssignmentError(
                "This trainer has already been assigned to the selected requirement.",
                HTTP_STATUS.CONFLICT,
                ERROR_CODES.RESOURCE_CONFLICT
            );
        }

        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * @name getTrainerAssignmentList
 * @description Retrieves paginated trainer assignments
 * belonging to the selected organization.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {number} params.page
 * @param {number} params.limit
 * @param {string} [params.status]
 * @param {string} [params.requirementId]
 * @returns {Promise<Object>}
 */
export const getTrainerAssignmentList = async ({
    orgId,
    page = 1,
    limit = 20,
    status,
    requirementId
}) => {
    return getTrainerAssignments({
        orgId,
        page,
        limit,
        status,
        requirementId
    });
};

/**
 * @name getTrainerAssignmentDetails
 * @description Retrieves one trainer assignment belonging
 * to the selected organization.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.assignmentId
 * @returns {Promise<Object>}
 */
export const getTrainerAssignmentDetails = async ({
    orgId,
    assignmentId
}) => {
    const assignment = await getTrainerAssignmentById({
        orgId,
        assignmentId
    });

    if (!assignment) {
        throw createAssignmentError(
            "Trainer assignment was not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return assignment;
};

/**
 * @name updateTrainerAssignmentLifecycle
 * @description Executes an assignment lifecycle transition.
 *
 * The assignment status update and capacity release are
 * performed in one transaction when capacity must be released.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.assignmentId
 * @param {string[]} params.allowedStatuses
 * @param {string} params.status
 * @param {boolean} params.releaseCapacity
 * @param {string} [params.cancellationReason]
 * @returns {Promise<Object>}
 */
const updateTrainerAssignmentLifecycle = async ({
    orgId,
    assignmentId,
    allowedStatuses,
    status,
    releaseCapacity = false,
    cancellationReason
}) => {
    const session = await mongoose.startSession();

    try {
        const assignment = await session.withTransaction(
            async () => {
                /**
                 * Retrieve the assignment within the organization.
                 */
                const existingAssignment = await getTrainerAssignmentById({
                    orgId,
                    assignmentId,
                    session
                });

                if (!existingAssignment) {
                    throw createAssignmentError(
                        "Trainer assignment was not found.",
                        HTTP_STATUS.NOT_FOUND,
                        ERROR_CODES.RESOURCE_NOT_FOUND
                    );
                }

                /**
                 * Apply the transition only if the current status
                 * is one of the permitted source statuses.
                 */
                const updatedAssignment = await transitionTrainerAssignment({
                    orgId,
                    assignmentId,
                    allowedStatuses,
                    status,
                    cancellationReason,
                    session
                });

                if (!updatedAssignment) {
                    throw createAssignmentError(
                        `Cannot change assignment from its current status to ${status}.`,
                        HTTP_STATUS.CONFLICT,
                        ERROR_CODES.RESOURCE_CONFLICT
                    );
                }

                /**
                 * Release capacity for completed and cancelled
                 * assignments, but not when starting an assignment.
                 */
                if (releaseCapacity) {
                    const releasedProfile = await releaseTrainerCapacity({
                        orgId,
                        trainerProfileId: existingAssignment.trainerProfile,
                        session
                    });

                    if (!releasedProfile) {
                        throw createAssignmentError(
                            "Trainer capacity could not be released. The assignment transition was rolled back.",
                            HTTP_STATUS.CONFLICT,
                            ERROR_CODES.RESOURCE_CONFLICT
                        );
                    }
                }

                return updatedAssignment;
            }
        );

        return assignment;
    } finally {
        await session.endSession();
    }
};

/**
 * @name startTrainerAssignment
 * @description Moves an assignment from assigned to in_progress.
 *
 * Trainer capacity remains reserved.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.assignmentId
 * @returns {Promise<Object>}
 */
export const startTrainerAssignment = async ({
    orgId,
    assignmentId
}) => {
    return updateTrainerAssignmentLifecycle({
        orgId,
        assignmentId,
        allowedStatuses: ["assigned"],
        status: "in_progress"
    });
};

/**
 * @name completeTrainerAssignment
 * @description Completes an in-progress assignment and
 * releases its reserved trainer capacity.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.assignmentId
 * @returns {Promise<Object>}
 */
export const completeTrainerAssignment = async ({
    orgId,
    assignmentId
}) => {
    return updateTrainerAssignmentLifecycle({
        orgId,
        assignmentId,
        allowedStatuses: ["in_progress"],
        status: "completed",
        releaseCapacity: true
    });
};

/**
 * @name cancelTrainerAssignment
 * @description Cancels an assigned or in-progress assignment
 * and releases its reserved trainer capacity.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.assignmentId
 * @param {string} [params.cancellationReason]
 * @returns {Promise<Object>}
 */
export const cancelTrainerAssignment = async ({
    orgId,
    assignmentId,
    cancellationReason
}) => {
    return updateTrainerAssignmentLifecycle({
        orgId,
        assignmentId,
        allowedStatuses: ["assigned", "in_progress"],
        status: "cancelled",
        releaseCapacity: true,
        cancellationReason
    });
};
