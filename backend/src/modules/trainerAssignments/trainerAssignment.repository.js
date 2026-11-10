
import TrainerAssignment from "./trainerAssignment.model.js";
import TrainerProfile from "../trainerProfiles/trainerProfile.model.js";
import TrainingRequirement from "../trainingRequirements/trainingRequirement.model.js";
import MatchRun from "../matchRun/matchRun.model.js";
import OrganizationMembership from "../organizationMemberships/organizationMembership.model.js";

/**
 * @name getRequirementForAssignment
 * @description Retrieves a matched or already assigned
 * training requirement belonging to the selected organization.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.requirementId
 * @param {Object} params.session
 * @returns {Promise<Object|null>}
 */
export const getRequirementForAssignment = async ({
    orgId,
    requirementId,
    session
}) => {
    return TrainingRequirement.findOne({
        _id: requirementId,
        org: orgId,
        status: {
            $in: ["matched", "assigned"]
        }
    }).session(session || null);
};

/**
 * @name getMatchRunForAssignment
 * @description Retrieves a matching run belonging to
 * the selected organization.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.matchRunId
 * @param {Object} params.session
 * @returns {Promise<Object|null>}
 */
export const getMatchRunForAssignment = async ({
    orgId,
    matchRunId,
    session
}) => {
    return MatchRun.findOne({
        _id: matchRunId,
        org: orgId
    }).session(session || null);
};

/**
 * @name getTrainerProfileForAssignment
 * @description Retrieves an approved trainer profile
 * belonging to the selected organization.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.trainerProfileId
 * @param {Object} params.session
 * @returns {Promise<Object|null>}
 */
export const getTrainerProfileForAssignment = async ({
    orgId,
    trainerProfileId,
    session
}) => {
    return TrainerProfile.findOne({
        _id: trainerProfileId,
        org: orgId,
        "approval.status": "approved"
    }).session(session || null);
};

/**
 * @name getApprovedTrainerMembership
 * @description Verifies that a trainer has an approved
 * trainer membership in the selected organization.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.userId
 * @param {Object} params.session
 * @returns {Promise<Object|null>}
 */
export const getApprovedTrainerMembership = async ({
    orgId,
    userId,
    session
}) => {
    return OrganizationMembership.findOne({
        org: orgId,
        user: userId,
        role: "trainer",
        status: "approved"
    }).session(session || null);
};

/**
 * @name reserveTrainerCapacity
 * @description Atomically reserves one active training slot.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.trainerProfileId
 * @param {Object} params.session
 * @returns {Promise<Object|null>}
 */
export const reserveTrainerCapacity = async ({
    orgId,
    trainerProfileId,
    session
}) => {
    return TrainerProfile.findOneAndUpdate(
        {
            _id: trainerProfileId,
            org: orgId,
            "approval.status": "approved",
            $expr: {
                $lt: [
                    "$availability.activeTrainings",
                    "$availability.maxConcurrentTrainings"
                ]
            }
        },
        {
            $inc: {
                "availability.activeTrainings": 1
            }
        },
        {
            returnDocument: "after",
            session,
            runValidators: true
        }
    );
};

/**
 * @name createTrainerAssignment
 * @description Creates a trainer assignment.
 *
 * @param {Object} params
 * @param {Object} params.assignmentData
 * @param {Object} params.session
 * @returns {Promise<Object>}
 */
export const createTrainerAssignment = async ({
    assignmentData,
    session
}) => {
    const [assignment] = await TrainerAssignment.create(
        [assignmentData],
        { session }
    );

    return assignment;
};

/**
 * Retrieves a trainer assignment by ID within an organisation.
 *
 * Populates only the safe fields needed by the API response.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.assignmentId
 * @returns {Promise<Object|null>}
 */
export const getTrainerAssignmentById = async ({
    orgId,
    assignmentId
}) => {
    return TrainerAssignment.findOne({
        _id: assignmentId,
        org: orgId
    })
        .populate("trainer", "firstName lastName email")
        .populate(
            "trainerProfile",
            "professionalDetails.headline"
        )
        .populate("requirement", "title status")
        .lean();
};


/**
 * @name getExistingTrainerAssignment
 * @description Checks whether the trainer profile has
 * already been assigned to the specified requirement.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.requirementId
 * @param {string} params.trainerProfileId
 * @param {Object} params.session
 * @returns {Promise<Object|null>}
 */
export const getExistingTrainerAssignment = async ({
    orgId,
    requirementId,
    trainerProfileId,
    session
}) => {
    return TrainerAssignment.findOne({
        org: orgId,
        requirement: requirementId,
        trainerProfile: trainerProfileId
    }).session(session || null);
};

/**
 * @name transitionTrainerAssignment
 * @description Atomically transitions a trainer assignment
 * between permitted lifecycle states.
 *
 * Records completion and cancellation timestamps
 * according to the target status.
 *
 * @param {Object} options
 * @returns {Promise<Object|null>}
 */
export const transitionTrainerAssignment = async ({
    orgId,
    assignmentId,
    allowedStatuses,
    status,
    cancellationReason,
    session
}) => {
    const update = {
        $set: {
            status,
            completedAt: status === "completed" ? new Date() : null
        }
    };

    if (status === "cancelled") {
        update.$set.cancelledAt = new Date();

        update.$set.cancellationReason =
            cancellationReason?.trim() || null;
    }

    return TrainerAssignment.findOneAndUpdate(
        {
            _id: assignmentId,
            org: orgId,
            status: {
                $in: allowedStatuses
            }
        },
        update,
        {
            returnDocument: "after",
            session,
            runValidators: true
        }
    );
};

/**
 * @name releaseTrainerCapacity
 * @description Releases one active training slot without
 * allowing the active training count to become negative.
 *
 * Must be called within the same transaction as the
 * assignment lifecycle update.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.trainerProfileId
 * @param {Object} params.session
 * @returns {Promise<Object|null>}
 */
export const releaseTrainerCapacity = async ({
    orgId,
    trainerProfileId,
    session
}) => {
    return TrainerProfile.findOneAndUpdate(
        {
            _id: trainerProfileId,
            org: orgId,
            "availability.activeTrainings": {
                $gt: 0
            }
        },
        {
            $inc: {
                "availability.activeTrainings": -1
            }
        },
        {
            returnDocument: "after",
            session,
            runValidators: true
        }
    );
};

/**
 * @name markRequirementAsAssigned
 * @description Changes a matched training requirement
 * to assigned after successful assignment creation.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.requirementId
 * @param {Object} params.session
 * @returns {Promise<Object|null>}
 */
export const markRequirementAsAssigned = async ({
    orgId,
    requirementId,
    session
}) => {
    return TrainingRequirement.findOneAndUpdate(
        {
            _id: requirementId,
            org: orgId,
            status: {
                $in: ["matched", "assigned"]
            }
        },
        {
            $set: {
                status: "assigned"
            }
        },
        {
            returnDocument: "after",
            session,
            runValidators: true
        }
    );
};

/**
 * @name getTrainerAssignments
 * @description Retrieves paginated assignments belonging
 * to the selected organization.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.status]
 * @param {string} [params.requirementId]
 * @returns {Promise<Object>}
 */
export const getTrainerAssignments = async ({
    orgId,
    page = 1,
    limit = 20,
    status,
    requirementId
}) => {
    const filter = {
        org: orgId
    };

    if (status) {
        filter.status = status;
    }

    if (requirementId) {
        filter.requirement = requirementId;
    }

    const skip = (page - 1) * limit;

    const [assignments, total] = await Promise.all([
        TrainerAssignment.find(filter)
            .populate("trainer", "firstName lastName email")
            .populate("trainerProfile", "professionalDetails.headline")
            .populate("requirement", "title status")
            .sort({
                assignedAt: -1,
                _id: -1
            })
            .skip(skip)
            .limit(limit)
            .lean(),

        TrainerAssignment.countDocuments(filter)
    ]);

    return {
        assignments,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * @name getTrainerAssignmentsByProfile
 * @description Retrieves assignments belonging to one
 * trainer profile within the selected organization.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.trainerProfileId
 * @param {Object} [params.session]
 * @returns {Promise<Array>}
 */
export const getTrainerAssignmentsByProfile = async ({
    orgId,
    trainerProfileId,
    session
}) => {
    return TrainerAssignment.find({
        org: orgId,
        trainerProfile: trainerProfileId
    })
        .sort({
            assignedAt: -1,
            _id: -1
        })
        .session(session || null)
        .lean();
};
